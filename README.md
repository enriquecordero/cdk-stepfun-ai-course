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
