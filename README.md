# AWS Step Functions Course - CDK Project

Este proyecto implementa un workflow de AWS Step Functions usando CDK TypeScript para aprender sobre orquestación de servicios AWS.

## Arquitectura

El proyecto incluye los siguientes componentes:

### 🪣 **S3 Bucket**

- **Nombre**: `statemachine-ai-course-enrique-sandbox-bucket`
- **Configuración**: Auto-delete habilitado, acceso público bloqueado
- **Contenido**: Archivo `data/file.txt` deployado automáticamente

### 👤 **IAM Role**

- **Nombre**: `StateMachineAICourseRole`
- **Servicio**: AWS Step Functions (`states.amazonaws.com`)
- **Permisos**:
  - `s3:GetObject` en el bucket y sus objetos
  - Política inline personalizada para acceso a S3

### ⚙️ **Step Function**

- **Nombre**: `MyStepFuncAIWorkFlow`
- **Funcionalidad**: Lee el archivo `data/file.txt` desde S3
- **Step implementado**:
  - `GetObjectFromS3`: Obtiene el contenido del archivo usando `s3:getObject`
  - Resultado guardado en `$.fileContent`

## Estructura del Proyecto

```
├── lib/
│   └── stepfuncions-course-stack.ts    # Stack principal con todos los recursos
├── data/
│   └── file.txt                        # Archivo de ejemplo ("Esto es un ejemplo!!")
├── test/
│   └── stepfuncions-course.test.ts     # Tests unitarios
└── README.md                           # Este archivo
```

## Deployment

### Prerrequisitos

- AWS CLI configurado
- Node.js y npm instalados
- AWS CDK CLI: `npm install -g aws-cdk`

### Comandos de Deploy

```bash
# Compilar TypeScript
npm run build

# Deployar el stack
npx cdk deploy

# Ver diferencias antes del deploy
npx cdk diff

# Generar template CloudFormation
npx cdk synth
```

## Explicación del Código

### 📦 **Imports y Dependencias**

```typescript
import {
  Role,
  ServicePrincipal,
  PolicyStatement,
  PolicyDocument,
  Policy,
} from "aws-cdk-lib/aws-iam";
import { Bucket, BlockPublicAccess } from "aws-cdk-lib/aws-s3";
import { BucketDeployment, Source } from "aws-cdk-lib/aws-s3-deployment";
import { StateMachine } from "aws-cdk-lib/aws-stepfunctions";
import { CallAwsService } from "aws-cdk-lib/aws-stepfunctions-tasks";
```

**¿Qué importamos?**

- **IAM**: Para crear roles y políticas de permisos
- **S3**: Para crear buckets y configurar acceso
- **S3 Deployment**: Para subir archivos automáticamente
- **Step Functions**: Para crear workflows y tasks

### 🪣 **Creación del S3 Bucket**

```typescript
const dataBucket = new Bucket(this, "StateMachineBucket", {
  bucketName: "statemachine-ai-course-enrique-sandbox-bucket",
  removalPolicy: cdk.RemovalPolicy.DESTROY,
  autoDeleteObjects: true,
  blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
});
```

**Explicación línea por línea:**

- `bucketName`: Nombre único del bucket en AWS
- `removalPolicy: DESTROY`: Permite eliminar el bucket al hacer `cdk destroy`
- `autoDeleteObjects: true`: Elimina automáticamente objetos antes de borrar bucket
- `blockPublicAccess: BLOCK_ALL`: Bloquea todo acceso público por seguridad

### 📁 **Deploy Automático de Archivos**

```typescript
new BucketDeployment(this, "DeployDataFile", {
  sources: [Source.asset("./data")],
  destinationBucket: dataBucket,
  destinationKeyPrefix: "data/",
});
```

**¿Qué hace?**

- `Source.asset('./data')`: Toma todos los archivos de la carpeta local `./data`
- `destinationBucket`: Los sube al bucket que creamos
- `destinationKeyPrefix: 'data/'`: Los coloca en la ruta `data/` dentro del bucket

### 🔐 **Política de Permisos S3**

```typescript
const policyS3Access = new PolicyDocument({
  statements: [
    new PolicyStatement({
      actions: ["s3:GetObject"],
      resources: [dataBucket.bucketArn, `${dataBucket.bucketArn}/*`],
    }),
  ],
});
```

**Desglose de permisos:**

- `actions: ['s3:GetObject']`: Permite leer objetos del bucket
- `dataBucket.bucketArn`: Permiso en el bucket mismo
- `${dataBucket.bucketArn}/*`: Permiso en todos los objetos dentro del bucket

### 👤 **Rol IAM para Step Functions**

```typescript
const stateMachineRole = new Role(this, "StateMachineAICourseRole", {
  assumedBy: new ServicePrincipal("states.amazonaws.com"),
});

stateMachineRole.attachInlinePolicy(
  new Policy(this, "S3AccessPolicy", {
    document: policyS3Access,
  })
);
```

**¿Por qué necesitamos esto?**

- `assumedBy: ServicePrincipal('states.amazonaws.com')`: Solo Step Functions puede usar este rol
- `attachInlinePolicy`: Adjunta los permisos de S3 al rol
- **Principio de menor privilegio**: Solo los permisos mínimos necesarios

### ⚙️ **Step Function con Task GetObject**

```typescript
const getObjectStep = new CallAwsService(this, "GetObjectFromS3", {
  service: "s3",
  action: "getObject",
  parameters: {
    Bucket: dataBucket.bucketName,
    Key: "data/file.txt",
  },
  iamResources: [dataBucket.arnForObjects("*")],
  resultPath: "$.fileContent",
});

const workflow = new StateMachine(this, "MyStepFuncAIWorkFlow", {
  stateMachineName: "MyStepFuncAIWorkFlow",
  role: stateMachineRole,
  definition: getObjectStep,
});
```

**Explicación del Step:**

- `service: 's3', action: 'getObject'`: Llama a la API `s3:GetObject`
- `parameters`: Especifica qué archivo leer (`data/file.txt`)
- `iamResources`: Define qué recursos puede acceder este step
- `resultPath: '$.fileContent'`: Guarda el resultado en la variable `fileContent`

**El Workflow:**

- `definition: getObjectStep`: Define que este step es todo el workflow (por ahora)
- `role: stateMachineRole`: Usa el rol IAM que creamos con permisos S3

### 🔄 **Flujo de Ejecución**

1. **Deploy**: CDK crea bucket, sube archivo, crea rol y Step Function
2. **Ejecución**: Step Function lee `data/file.txt` del bucket S3
3. **Resultado**: Contenido del archivo queda disponible en `$.fileContent`

## Funcionalidad

1. **Deploy automático**: El archivo `data/file.txt` se sube automáticamente al bucket S3
2. **Workflow execution**: El Step Function lee el archivo y almacena su contenido
3. **Permisos**: IAM role con permisos mínimos necesarios para la operación

## Comandos Útiles

- `npm run build` compile typescript to js
- `npm run watch` watch for changes and compile
- `npm run test` perform the jest unit tests
- `npx cdk deploy` deploy this stack to your default AWS account/region
- `npx cdk diff` compare deployed stack with current state
- `npx cdk synth` emits the synthesized CloudFormation template
- `npx cdk destroy` elimina todos los recursos del stack

## Próximos Pasos

- [ ] Agregar más steps al workflow
- [ ] Implementar manejo de errores
- [ ] Agregar integración con Lambda
- [ ] Configurar logging y monitoreo
