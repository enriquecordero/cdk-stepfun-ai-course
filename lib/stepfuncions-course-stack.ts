import { Role, ServicePrincipal, PolicyStatement, Effect, PolicyDocument, Policy } from 'aws-cdk-lib/aws-iam';
import { Bucket, BlockPublicAccess } from 'aws-cdk-lib/aws-s3';
import { BucketDeployment, Source } from 'aws-cdk-lib/aws-s3-deployment';
import { StateMachine, Pass, TaskInput } from 'aws-cdk-lib/aws-stepfunctions';
import { CallAwsService } from 'aws-cdk-lib/aws-stepfunctions-tasks';
import * as cdk from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
// import * as sqs from 'aws-cdk-lib/aws-sqs';

export class StepfuncionsCourseStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const dataBucket = new Bucket(this,'StateMachineBucket',{
      bucketName: "statemachine-ai-course-enrique-sandbox-bucket",
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL
    })

    // Deployment automático del archivo data/file.txt
    new BucketDeployment(this, 'DeployDataFile', {
      sources: [Source.asset('./data')],
      destinationBucket: dataBucket,
      destinationKeyPrefix: 'data/'
    })

        // PolicyDocument para acceso a S3
    const policyS3Access = new PolicyDocument({
      statements: [
        new PolicyStatement({
          actions: ['s3:GetObject'],
          resources: [
            dataBucket.bucketArn,
            `${dataBucket.bucketArn}/*`
          ]
        })
      ]
    })



    const stateMachineRole = new Role(this,'StateMachineAICourseRole',{
      assumedBy : new ServicePrincipal('states.amazonaws.com')
    })
    // Adjuntar la política al rol
    stateMachineRole.attachInlinePolicy(new Policy(this, 'S3AccessPolicy', {
      document: policyS3Access
    }))

    // Step para leer el archivo de S3
    const getObjectStep = new CallAwsService(this, 'GetObjectFromS3', {
      service: 's3',
      action: 'getObject',
      parameters: {
        Bucket: dataBucket.bucketName,
        Key: 'data/file.txt'
      },
      iamResources: [dataBucket.arnForObjects('*')],
      resultPath: '$.fileContent'
    })

    const workflow = new StateMachine(this,'MyStepFuncAIWorkFlow',{
      stateMachineName: "MyStepFuncAIWorkFlow",
      role : stateMachineRole,
      definition: getObjectStep
    })

  }
}
