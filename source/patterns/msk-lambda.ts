/** ************************************************************************************************
*   Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.                             *
*   SPDX-License-Identifier: Apache-2.0                                                            *
 ************************************************************************************************ */


import * as cdk  from 'aws-cdk-lib';
import { aws_lambda as lambda } from 'aws-cdk-lib';

import { Construct } from 'constructs';
import { SolutionHelper } from '../lib/solution-helper';
import { SolutionStackProps } from '../bin/solution-props';
import { KafkaConsumer } from '../lib/msk-consumer';

export class MskLambda extends cdk.Stack {
    constructor(scope: Construct, id: string, props: SolutionStackProps) {
        super(scope, id, props);

        //---------------------------------------------------------------------
        // Lambda function configuration
        const clusterArn = new cdk.CfnParameter(this, 'ClusterArn', {
            type: 'String',
            allowedPattern: 'arn:(aws[a-zA-Z0-9-]*):([a-zA-Z0-9\\-])+:([a-z]{2}(-gov)?-[a-z]+-\\d{1})?:(\\d{12})?:(.*)',
            constraintDescription: 'Cluster ARN must be in the following format: arn:${Partition}:kafka:${Region}:${Account}:cluster/${ClusterName}/${UUID}'
        });

        const batchSize = new cdk.CfnParameter(this, 'BatchSize', {
            type: 'Number',
            default: 100,
            minValue: 1,
            maxValue: 10000
        });

        const topicName = new cdk.CfnParameter(this, 'TopicName', {
            type: 'String',
            allowedPattern: '.+',
            constraintDescription: 'Topic name must not be empty'
        });

        const secretArn = new cdk.CfnParameter(this, 'SecretArn', {
            type: 'String',
            maxLength: 200
        });

        const lambdaConsumer = new KafkaConsumer(this, 'LambdaFn', {
            clusterArn: clusterArn.valueAsString,
            scramSecretArn: secretArn.valueAsString,
            batchSize: batchSize.valueAsNumber,
            startingPosition: lambda.StartingPosition.LATEST,
            topicName: topicName.valueAsString,
            enabled: true,
            code: lambda.Code.fromAsset('lambda/msk-lambda-consumer'),
            timeout: cdk.Duration.minutes(5)
        });

        //---------------------------------------------------------------------
        // Solution metrics
        new SolutionHelper(this, 'SolutionHelper', {
            solutionId: props.solutionId,
            pattern: MskLambda.name
        });

        //---------------------------------------------------------------------
        // Template metadata
        this.templateOptions.metadata = {
            'AWS::CloudFormation::Interface': {
                ParameterGroups: [
                    {
                        Label: { default: 'AWS Lambda consumer configuration' },
                        Parameters: [clusterArn.logicalId, batchSize.logicalId, topicName.logicalId, secretArn.logicalId]
                    }
                ],
                ParameterLabels: {
                    [clusterArn.logicalId]: {
                        default: 'ARN of the MSK cluster'
                    },
                    [batchSize.logicalId]: {
                        default: 'Maximum number of items to retrieve in a single batch'
                    },
                    [topicName.logicalId]: {
                        default: 'Name of a Kafka topic to consume (topic must already exist before the stack is launched)'
                    },
                    [secretArn.logicalId]: {
                        default: '(Optional) Secret ARN used for SASL/SCRAM authentication of the brokers in your MSK cluster'
                    }
                }
            }
        };

        //---------------------------------------------------------------------
        // Stack outputs
        new cdk.CfnOutput(this, 'LambdaFunctionName', {
            description: 'Name of the AWS Lambda function',
            value: lambdaConsumer.Function.functionName
        });
    }
}
