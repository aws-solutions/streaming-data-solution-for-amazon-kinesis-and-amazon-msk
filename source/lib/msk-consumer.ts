/*********************************************************************************************************************
 *  Copyright 2020-2021 Amazon.com, Inc. or its affiliates. All Rights Reserved.                                      *
 *                                                                                                                    *
 *  Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance    *
 *  with the License. A copy of the License is located at                                                             *
 *                                                                                                                    *
 *      http://www.apache.org/licenses/LICENSE-2.0                                                                    *
 *                                                                                                                    *
 *  or in the 'license' file accompanying this file. This file is distributed on an 'AS IS' BASIS, WITHOUT WARRANTIES *
 *  OR CONDITIONS OF ANY KIND, express or implied. See the License for the specific language governing permissions    *
 *  and limitations under the License.                                                                                *
 *********************************************************************************************************************/

import * as cdk from '@aws-cdk/core';
import * as lambda from '@aws-cdk/aws-lambda';
import * as iam from '@aws-cdk/aws-iam';

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

export class KafkaConsumer extends cdk.Construct {
    public readonly Function: lambda.IFunction;

    private readonly IsSecretEmpty: cdk.CfnCondition;
    private readonly IsSecretNotEmpty: cdk.CfnCondition;

    private MIN_BATCH_SIZE: number = 1;
    private MAX_BATCH_SIZE: number = 10000;
    private MIN_TIMEOUT_SECONDS: number = 1;
    private MAX_TIMEOUT_SECONDS: number = 900;

    constructor(scope: cdk.Construct, id: string, props: KafkaConsumerProps) {
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
        const executionRole = this.createRole();
        const secretPolicy = this.createPolicyForSecret(executionRole, props.scramSecretArn!);

        const lambdaFn = new lambda.Function(this, 'Consumer', {
            runtime: lambda.Runtime.NODEJS_14_X,
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
        cfnMapping.addDependsOn(secretPolicy);

        return lambdaFn;
    }

    private createRole() {
        const executionRole = new ExecutionRole(this, 'Role', {
            inlinePolicyName: 'MskPolicy',
            inlinePolicyDocument: new iam.PolicyDocument({
                statements: [
                    new iam.PolicyStatement({
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
        const kmsKeyArn = this.getKmsKeyForSecret(scramSecretArn);

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
            runtime: lambda.Runtime.PYTHON_3_8,
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
}
