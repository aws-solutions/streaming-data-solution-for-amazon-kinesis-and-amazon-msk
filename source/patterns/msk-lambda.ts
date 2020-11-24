/*********************************************************************************************************************
 *  Copyright 2020 Amazon.com, Inc. or its affiliates. All Rights Reserved.                                           *
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

import { SolutionHelper } from '../lib/solution-helper';
import { SolutionStackProps } from './solution-props';
import { KafkaConsumer } from '../lib/msk-consumer';
import { KafkaMonitoring } from '../lib/msk-monitoring';

export class MskLambda extends cdk.Stack {
    constructor(scope: cdk.Construct, id: string, props: SolutionStackProps) {
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

        const lambdaConsumer = new KafkaConsumer(this, 'LambdaFn', {
            clusterArn: clusterArn.valueAsString,
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
        // Monitoring (dashboard) configuration
        const dashboardName = cdk.Fn.join('-', ['MSK2', 'Monitoring', cdk.Aws.REGION]);

        new KafkaMonitoring(this, 'Monitoring', {
            clusterArn: clusterArn.valueAsString,
            dashboardName: dashboardName
        });

        //---------------------------------------------------------------------
        // Template metadata

        this.templateOptions.metadata = {
            'AWS::CloudFormation::Interface': {
                ParameterGroups: [
                    {
                        Label: { default: 'AWS Lambda consumer configuration' },
                        Parameters: [clusterArn.logicalId, batchSize.logicalId, topicName.logicalId]
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
                        default: 'Name of a Kafka topic to consume'
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

        new cdk.CfnOutput(this, 'LambdaMskMapping', {
            description: 'Identifier for the AWS Lambda event source mapping',
            value: lambdaConsumer.EventMapping.eventSourceMappingId
        });

        new cdk.CfnOutput(this, 'CloudWatchDashboardName', {
            description: 'Name of the Amazon CloudWatch dashboard',
            value: dashboardName
        });
    }
}
