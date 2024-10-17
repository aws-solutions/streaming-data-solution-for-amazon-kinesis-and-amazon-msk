/** ************************************************************************************************
*   Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.                             *
*   SPDX-License-Identifier: Apache-2.0                                                            *
 ************************************************************************************************ */


import * as cdk  from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { aws_lambda as lambda, aws_iam as iam } from 'aws-cdk-lib';

import { ExecutionRole } from './lambda-role-cloudwatch';
import { CfnNagHelper } from './cfn-nag-helper';

export interface KafkaConsumerProps {
    readonly clusterArn: string;
    readonly scramSecretArn?: string;

    readonly batchSize: number;
    readonly startingPosition: lambda.StartingPosition;
    readonly topicName: string;
    readonly enabled: boolean;

    readonly code: lambda.Code;
    readonly timeout: cdk.Duration;
    readonly environmentVariables?: { [key: string]: string };
}

export class KafkaConsumer extends Construct {
    public readonly Function: lambda.IFunction;

    private readonly IsSecretEmpty: cdk.CfnCondition;
    private readonly IsSecretNotEmpty: cdk.CfnCondition;

    private MIN_BATCH_SIZE: number = 1;
    private MAX_BATCH_SIZE: number = 10000;
    private MIN_TIMEOUT_SECONDS: number = 1;
    private MAX_TIMEOUT_SECONDS: number = 900;

    constructor(scope: Construct, id: string, props: KafkaConsumerProps) {
        super(scope, id);

        if (!cdk.Token.isUnresolved(props.batchSize)) {
            if (props.batchSize < this.MIN_BATCH_SIZE || props.batchSize > this.MAX_BATCH_SIZE) {
                throw new Error(`batchSize must be between ${this.MIN_BATCH_SIZE} and ${this.MAX_BATCH_SIZE} (given ${props.batchSize})`);
            }
        }

        const timeoutSeconds = props.timeout.toSeconds();
        if (timeoutSeconds < this.MIN_TIMEOUT_SECONDS || timeoutSeconds > this.MAX_TIMEOUT_SECONDS) {
            throw new Error(`timeout must be a value between ${this.MIN_TIMEOUT_SECONDS} and ${this.MAX_TIMEOUT_SECONDS} seconds (given ${timeoutSeconds})`);
        }

        this.IsSecretEmpty = new cdk.CfnCondition(this, 'IsSecretEmptyCondition', {
            expression: cdk.Fn.conditionEquals(props.scramSecretArn, '')
        });

        this.IsSecretNotEmpty = new cdk.CfnCondition(this, 'IsSecretNotEmptyCondition', {
            expression: cdk.Fn.conditionNot(this.IsSecretEmpty)
        });

        this.Function = this.createFunction(props);
    }

    private createFunction(props: KafkaConsumerProps) {
        const executionRole = this.createRole(props.clusterArn, props.topicName);
        const secretPolicy = this.createPolicyForSecret(executionRole, props.scramSecretArn!);

        const lambdaFn = new lambda.Function(this, 'Consumer', {
            runtime: lambda.Runtime.NODEJS_20_X,
            handler: 'index.handler',
            role: executionRole,
            code: props.code,
            timeout: props.timeout,
            environment: props.environmentVariables
        });

        const mappingProps: lambda.EventSourceMappingOptions = {
            eventSourceArn: props.clusterArn,
            startingPosition: props.startingPosition,
            batchSize: props.batchSize,
            kafkaTopic: props.topicName,
            enabled: props.enabled
        };

        const mappingWithoutSecret = lambdaFn.addEventSourceMapping('Mapping', mappingProps);
        const mappingWithSecret = lambdaFn.addEventSourceMapping('MappingWithSecret', {
            ...mappingProps,
            sourceAccessConfigurations: [{
                type: lambda.SourceAccessConfigurationType.SASL_SCRAM_512_AUTH,
                uri: props.scramSecretArn!
            }]
        });

        (mappingWithoutSecret.node.defaultChild as lambda.CfnEventSourceMapping).cfnOptions.condition = this.IsSecretEmpty;

        const cfnMapping = mappingWithSecret.node.defaultChild as lambda.CfnEventSourceMapping;
        cfnMapping.cfnOptions.condition = this.IsSecretNotEmpty;
        cfnMapping.addDependency(secretPolicy);

        return lambdaFn;
    }

    private createRole(clusterArn: string, topicName: string) {
        const components = cdk.Arn.split(clusterArn, cdk.ArnFormat.SLASH_RESOURCE_NAME);
        const clusterName = components.resourceName!;

        // The permissions that Lambda requires to interact with MSK are described on this page:
        // https://docs.aws.amazon.com/lambda/latest/dg/with-msk.html#msk-permissions
        const executionRole = new ExecutionRole(this, 'Role', {
            inlinePolicyName: 'MskPolicy',
            inlinePolicyDocument: new iam.PolicyDocument({
                statements: [
                    new iam.PolicyStatement({
                        sid: 'NetworkingPolicy',
                        actions: [
                            'kafka:DescribeCluster',
                            'kafka:GetBootstrapBrokers',
                            'kafka:ListScramSecrets',
                            'ec2:CreateNetworkInterface',
                            'ec2:DescribeNetworkInterfaces',
                            'ec2:DescribeVpcs',
                            'ec2:DeleteNetworkInterface',
                            'ec2:DescribeSubnets',
                            'ec2:DescribeSecurityGroups'
                        ],
                        resources: ['*']
                    }),
                    new iam.PolicyStatement({
                        sid: 'IamPolicy',
                        actions: [
                            'kafka-cluster:Connect',
                            'kafka-cluster:DescribeGroup',
                            'kafka-cluster:AlterGroup',
                            'kafka-cluster:DescribeTopic',
                            'kafka-cluster:ReadData',
                            'kafka-cluster:DescribeClusterDynamicConfiguration'
                        ],
                        resources: [
                            clusterArn,
                            // TODO: Remove `*` once issue with Arn.Split has been resolved.
                            `arn:${cdk.Aws.PARTITION}:kafka:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:topic/${clusterName}/*/${topicName}`,
                            `arn:${cdk.Aws.PARTITION}:kafka:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:group/${clusterName}/*/*`
                        ]
                    })
                ]
            })
        });

        const cfnRole = executionRole.Role.node.defaultChild as iam.CfnRole;
        CfnNagHelper.addSuppressions(cfnRole, {
            Id: 'W11',
            Reason: 'Actions do not support resource level permissions'
        });

        return executionRole.Role;
    }

    private createPolicyForSecret(functionRole: iam.IRole, scramSecretArn: string) {
        const kmsKeyId = this.getKmsKeyForSecret(scramSecretArn);
        const kmsKeyArn = this.getKmsArn(kmsKeyId);

        const secretPolicy = new iam.Policy(this, 'SecretPolicy', {
            document: new iam.PolicyDocument({
                statements: [
                    new iam.PolicyStatement({
                        actions: ['kms:Decrypt'],
                        resources: [kmsKeyArn],
                        conditions: {
                            StringEquals: {
                                'kms:ViaService': `secretsmanager.${cdk.Aws.REGION}.${cdk.Aws.URL_SUFFIX}`
                            }
                        }
                    }),
                    new iam.PolicyStatement({
                        actions: ['secretsmanager:GetSecretValue'],
                        resources: [scramSecretArn]
                    })
                ]
            }),
            roles: [functionRole]
        });

        const cfnPolicy = secretPolicy.node.defaultChild as iam.CfnPolicy;
        cfnPolicy.cfnOptions.condition = this.IsSecretNotEmpty;

        return cfnPolicy;
    }

    private getKmsKeyForSecret(secretArn: string) {
        const customResouceRole = new ExecutionRole(this, 'CustomResourceRole', {
            inlinePolicyName: 'SecretMetadataPolicy',
            inlinePolicyDocument: new iam.PolicyDocument({
                statements: [new iam.PolicyStatement({
                    resources: [secretArn],
                    actions: ['secretsmanager:DescribeSecret']
                })]
            })
        });

        const customResourceFunction = new lambda.Function(this, 'CustomResource', {
            runtime: lambda.Runtime.PYTHON_3_12,
            handler: 'lambda_function.handler',
            role: customResouceRole.Role,
            code: lambda.Code.fromAsset('lambda/secrets-manager-metadata'),
            timeout: cdk.Duration.seconds(30)
        });

        const secretMetadata = new cdk.CustomResource(this, 'SecretMetadata', {
            serviceToken: customResourceFunction.functionArn,
            properties: { SecretArn: secretArn },
            resourceType: 'Custom::SecretMetadata'
        });

        (customResouceRole.Role.node.defaultChild as iam.CfnRole).cfnOptions.condition = this.IsSecretNotEmpty;
        (customResourceFunction.node.defaultChild as lambda.CfnFunction).cfnOptions.condition = this.IsSecretNotEmpty;
        (secretMetadata.node.defaultChild as cdk.CfnResource).cfnOptions.condition = this.IsSecretNotEmpty;

        return secretMetadata.getAttString('KmsKeyId');
    }

    private getKmsArn(kmsKeyId: string) {
        const kmsMetadataResourceRole = new ExecutionRole(this, 'KmsMetadataResourceRole', {
            inlinePolicyName: 'KmsMetadataPolicy',
            inlinePolicyDocument: new iam.PolicyDocument({
                statements: [new iam.PolicyStatement({
                    resources: ['*'],
                    actions: ['kms:DescribeKey', 'kms:ListKeys']
                })]
            })
        });

        const cfnRole = kmsMetadataResourceRole.Role.node.defaultChild as iam.CfnRole;
        CfnNagHelper.addSuppressions(cfnRole, {
            Id: 'W11',
            Reason: 'KMS actions do not support resource level permissions'
        });

        const kmsMetadataResourceFunction = new lambda.Function(this, 'KmsMetadataResource', {
            runtime: lambda.Runtime.PYTHON_3_12,
            handler: 'lambda_function.handler',
            role: kmsMetadataResourceRole.Role,
            code: lambda.Code.fromAsset('lambda/kms-metadata'),
            timeout: cdk.Duration.seconds(30)
        });

        const kmsMetadata = new cdk.CustomResource(this, 'KmsMetadata', {
            serviceToken: kmsMetadataResourceFunction.functionArn,
            properties: { KmsKeyId: kmsKeyId },
            resourceType: 'Custom::KmsMetadata'
        });

        (kmsMetadataResourceRole.Role.node.defaultChild as iam.CfnRole).cfnOptions.condition = this.IsSecretNotEmpty;
        (kmsMetadataResourceFunction.node.defaultChild as lambda.CfnFunction).cfnOptions.condition = this.IsSecretNotEmpty;
        (kmsMetadata.node.defaultChild as cdk.CfnResource).cfnOptions.condition = this.IsSecretNotEmpty;

        return kmsMetadata.getAttString('KmsKeyArn');
    }
}
