// ========================================
// 📦 IMPORTS - Librerías necesarias para el proyecto
// ========================================
import { Role, ServicePrincipal, PolicyStatement, Effect, PolicyDocument, Policy } from 'aws-cdk-lib/aws-iam';
import { Bucket, BlockPublicAccess } from 'aws-cdk-lib/aws-s3';
import { BucketDeployment, Source } from 'aws-cdk-lib/aws-s3-deployment';
import { StateMachine, Pass, TaskInput, Chain } from 'aws-cdk-lib/aws-stepfunctions';
import { CallAwsService } from 'aws-cdk-lib/aws-stepfunctions-tasks';
import { Connection, Authorization } from 'aws-cdk-lib/aws-events';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';
import * as cdk from 'aws-cdk-lib/core';
import { Construct } from 'constructs';

// ========================================
// 🏗️ STACK CLASS DEFINITION
// ========================================
export class StepfuncionsCourseStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ========================================
    // 🪣 S3 BUCKET CONFIGURATION
    // ========================================
    // Crear bucket S3 para almacenar archivos de datos
    const dataBucket = new Bucket(this,'StateMachineBucket',{
      bucketName: "statemachine-ai-course-enrique-sandbox-bucket", // Nombre único del bucket
      removalPolicy: cdk.RemovalPolicy.DESTROY,                    // Permite eliminar bucket con cdk destroy
      autoDeleteObjects: true,                                     // Elimina objetos automáticamente antes de borrar bucket
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL              // Bloquea todo acceso público por seguridad
    })

    // ========================================
    // 📁 AUTOMATIC FILE DEPLOYMENT
    // ========================================
    // Sube automáticamente archivos de la carpeta ./data al bucket S3
    new BucketDeployment(this, 'DeployDataFile', {
      sources: [Source.asset('./data')],          // Carpeta local con archivos a subir
      destinationBucket: dataBucket,              // Bucket destino
      destinationKeyPrefix: 'data/'               // Prefijo en S3 (carpeta virtual)
    })

    // ========================================
    // 🔐 SECRETS MANAGER INTEGRATION
    // ========================================
    // Referencia al secret existente que contiene la API key de Perplexity
    const perplexitySecret = Secret.fromSecretNameV2(this, 'PerplexitySecret', 'perplexity_key')

    // ========================================
    // 🌉 EVENTBRIDGE CONNECTION
    // ========================================
    // Conexión segura para llamadas HTTP a APIs externas (Perplexity)
    const perplexityConnection = new Connection(this, 'PerplexityConnection', {
      connectionName: 'perplexity',                                           // Nombre de la conexión
      description: 'Connection to Perplexity AI API',                        // Descripción
      authorization: Authorization.apiKey('Authorization', perplexitySecret.secretValue) // Autenticación con API key del secret
    })

    // ========================================
    // 🛡️ IAM POLICIES DEFINITION
    // ========================================
    
    // Política para acceso de lectura a S3
    const policyS3Access = new PolicyDocument({
      statements: [
        new PolicyStatement({
          actions: ['s3:GetObject'],                    // Permiso para leer objetos
          resources: [
            dataBucket.bucketArn,                       // Acceso al bucket
            `${dataBucket.bucketArn}/*`                 // Acceso a todos los objetos dentro del bucket
          ]
        })
      ]
    })

    // Política para usar EventBridge Connection y acceder a Secrets Manager
    const policyEventBridgeConnection = new PolicyDocument({
      statements: [
        new PolicyStatement({
          actions: [
            'events:RetrieveConnectionCredentials',     // Obtener credenciales de la conexión
            'secretsmanager:GetSecretValue',            // Leer valor del secret
            'secretsmanager:DescribeSecret'             // Obtener metadatos del secret
          ],
          resources: [
            perplexityConnection.connectionArn,         // ARN de la conexión EventBridge
            perplexitySecret.secretArn                  // ARN del secret en Secrets Manager
          ]
        })
      ]
    })

    // ========================================
    // 👤 IAM ROLE FOR STEP FUNCTIONS
    // ========================================
    // Rol que Step Functions asumirá para ejecutar las tareas
    const stateMachineRole = new Role(this,'StateMachineAICourseRole',{
      assumedBy : new ServicePrincipal('states.amazonaws.com')  // Solo Step Functions puede asumir este rol
    })
    
    // Adjuntar política de acceso a S3 al rol
    stateMachineRole.attachInlinePolicy(new Policy(this, 'S3AccessPolicy', {
      document: policyS3Access
    }))
    
    // Adjuntar política de EventBridge Connection al rol
    stateMachineRole.attachInlinePolicy(new Policy(this, 'EventBridgeConnectionPolicy', {
      document: policyEventBridgeConnection
    }))

    // ========================================
    // ⚙️ STEP FUNCTIONS TASKS DEFINITION
    // ========================================
    
    // STEP 1: Leer archivo desde S3
    const getObjectStep = new CallAwsService(this, 'GetObjectFromS3', {
      service: 's3',                                    // Servicio AWS a llamar
      action: 'getObject',                              // Acción específica del servicio
      parameters: {
        Bucket: dataBucket.bucketName,                  // Nombre del bucket
        Key: 'data/file.txt'                            // Ruta del archivo en S3
      },
      iamResources: [dataBucket.arnForObjects('*')],    // Recursos que este step puede acceder
      resultPath: '$.fileContent'                       // Donde guardar el resultado en el estado
    })

    // STEP 2: Llamar a Perplexity AI para resumir artículo
    const callPerplexityStep = new CallAwsService(this, 'CallPerplexityForSummarizing', {
      service: 'states',                                // Servicio Step Functions para HTTP calls
      action: 'http:invoke',                            // Acción para llamadas HTTP
      parameters: {
        ApiEndpoint: 'https://api.perplexity.ai/chat/completions',  // URL de la API
        Method: 'POST',                                              // Método HTTP
        InvocationConfig: {
          ConnectionArn: perplexityConnection.connectionArn          // Usar conexión EventBridge para auth
        },
        RequestBody: {                                               // Cuerpo de la petición HTTP
          model: 'sonar',                                            // Modelo de Perplexity a usar
          messages: [
            {
              role: 'user',                                          // Rol del mensaje
              content: 'Can you summarize this article for me https://aws.amazon.com/blogs/aws/aws-lambda-functions-now-scale-12-times-faster-when-handling-high-volume-requests/' // Prompt para el AI
            }
          ]
        }
      },
      iamResources: ['*'],                              // Recursos (amplio para HTTP calls)
      resultPath: '$.perplexityResponse'                // Donde guardar la respuesta del AI
    })

    // ========================================
    // 🔄 WORKFLOW DEFINITION
    // ========================================
    // Definir secuencia de pasos: S3 GetObject → Perplexity AI Call
    const workflowDefinition = Chain.start(getObjectStep).next(callPerplexityStep)

    // ========================================
    // 🚀 STEP FUNCTIONS STATE MACHINE
    // ========================================
    // Crear la máquina de estados que orquesta todo el workflow
    const workflow = new StateMachine(this,'MyStepFuncAIWorkFlow',{
      stateMachineName: "MyStepFuncAIWorkFlow",         // Nombre de la State Machine
      role : stateMachineRole,                          // Rol IAM con permisos necesarios
      definition: workflowDefinition                    // Definición del workflow (cadena de pasos)
    })

  }
}