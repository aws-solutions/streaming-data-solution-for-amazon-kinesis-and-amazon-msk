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
import * as logs from '@aws-cdk/aws-logs';

import { ApiGatewayToKinesisStreams } from '@aws-solutions-constructs/aws-apigateway-kinesisstreams';
import { KinesisStreamsToLambda } from '@aws-solutions-constructs/aws-kinesisstreams-lambda';

import { DataStream } from '../lib/kds-data-stream';
import { SolutionHelper } from '../lib/solution-helper';
import { SolutionStackProps } from './solution-props';
import { DataStreamMonitoring } from '../lib/kds-monitoring';

export class ApiGwKdsLambda extends cdk.Stack {
    constructor(scope: cdk.Construct, id: string, props: SolutionStackProps) {
        super(scope, id, props);

        //---------------------------------------------------------------------
        // Kinesis Data Stream configuration

        const shardCount = new cdk.CfnParameter(this, 'ShardCount', {
            type: 'Number',
            default: 2,
            minValue: 1,
            maxValue: 200
        });

        const dataRetention = new cdk.CfnParameter(this, 'RetentionHours', {
            type: 'Number',
            default: 24,
            minValue: 24,
            maxValue: 8760
        });

        const enhancedMonitoring = new cdk.CfnParameter(this, 'EnableEnhancedMonitoring', {
            type: 'String',
            default: 'false',
            allowedValues: ['true', 'false']
        });

        const kds = new DataStream(this, 'Kds', {
            shardCount: shardCount.valueAsNumber,
            retentionPeriod: cdk.Duration.hours(dataRetention.valueAsNumber),
            enableEnhancedMonitoring: enhancedMonitoring.valueAsString
        });

        //---------------------------------------------------------------------
        // API Gateway configuration

        const rateLimit = new cdk.CfnParameter(this, 'ThrottlingRateLimit', {
            type: 'Number',
            default: 100,
            minValue: 1,
            maxValue: 10000
        });

        const burstLimit = new cdk.CfnParameter(this, 'ThrottlingBurstLimit', {
            type: 'Number',
            default: 50,
            minValue: 0,
            maxValue: 5000
        });

        const apiGwToKds = new ApiGatewayToKinesisStreams(this, 'ApiGwKds', {
            apiGatewayProps: {
                restApiName: `${cdk.Aws.STACK_NAME}-kinesis-proxy`,
                deployOptions: {
                    methodOptions: {
                        '/*/*': {
                            throttlingRateLimit: rateLimit.valueAsNumber,
                            throttlingBurstLimit: burstLimit.valueAsNumber
                        }
                    }
                }
            },
            existingStreamObj: kds.Stream
        });

        (apiGwToKds.node.findChild('ApiAccessLogGroup').node.defaultChild as logs.CfnLogGroup).cfnOptions.metadata = {
            cfn_nag: {
                rules_to_suppress: [
                    {
                        id: 'W84',
                        reason: 'Log group data is always encrypted in CloudWatch Logs using an AWS Managed KMS Key'
                    },
                    {
                        id: 'W86',
                        reason: 'Log group retention is intentionally set to "Never Expire"'
                    }
                ]
            }
        };

        //---------------------------------------------------------------------
        // Lambda function configuration

        const batchSize = new cdk.CfnParameter(this, 'BatchSize', {
            type: 'Number',
            default: 100,
            minValue: 1,
            maxValue: 10000
        });

        const parallelization = new cdk.CfnParameter(this, 'ParallelizationFactor', {
            type: 'Number',
            default: 1,
            minValue: 1,
            maxValue: 10
        });

        const retryAttempts = new cdk.CfnParameter(this, 'MaxRetryAttempts', {
            type: 'Number',
            default: 3,
            minValue: 1,
            maxValue: 10000
        });

        const kdsToLambda = new KinesisStreamsToLambda(this, 'KdsLambda', {
            existingStreamObj: kds.Stream,
            createCloudWatchAlarms: false,
            deploySqsDlqQueue: true,
            lambdaFunctionProps: {
                runtime: lambda.Runtime.NODEJS_12_X,
                handler: 'index.handler',
                code: lambda.Code.fromAsset('lambda/kds-lambda-consumer'),
                timeout: cdk.Duration.minutes(5)
            },
            kinesisEventSourceProps: {
                startingPosition: lambda.StartingPosition.LATEST,
                batchSize: batchSize.valueAsNumber,
                retryAttempts: parallelization.valueAsNumber,
                parallelizationFactor: retryAttempts.valueAsNumber,
                bisectBatchOnError: true
            }
        });

        //---------------------------------------------------------------------
        // Monitoring (dashboard and alarms) configuration

        new DataStreamMonitoring(this, 'Monitoring', {
            streamName: kds.Stream.streamName,
            lambdaFunctionName: kdsToLambda.lambdaFunction.functionName
        });

        //---------------------------------------------------------------------
        // Solution metrics

        new SolutionHelper(this, 'SolutionHelper', {
            solutionId: props.solutionId,
            pattern: ApiGwKdsLambda.name,

            shardCount: shardCount.valueAsNumber,
            retentionHours: dataRetention.valueAsNumber,
            enhancedMonitoring: enhancedMonitoring.valueAsString
        });

        //---------------------------------------------------------------------
        // Template metadata

        this.templateOptions.metadata = {
            'AWS::CloudFormation::Interface': {
                ParameterGroups: [
                    {
                        Label: { default: 'Amazon API Gateway configuration' },
                        Parameters: [rateLimit.logicalId, burstLimit.logicalId]
                    },
                    {
                        Label: { default: 'Amazon Kinesis Data Streams configuration' },
                        Parameters: [shardCount.logicalId, dataRetention.logicalId, enhancedMonitoring.logicalId]
                    },
                    {
                        Label: { default: 'AWS Lambda consumer configuration' },
                        Parameters: [batchSize.logicalId, parallelization.logicalId, retryAttempts.logicalId]
                    }
                ],
                ParameterLabels: {
                    [rateLimit.logicalId]: {
                        default: 'Steady-state requests per second'
                    },
                    [burstLimit.logicalId]: {
                        default: 'Burst requests per second'
                    },

                    [shardCount.logicalId]: {
                        default: 'Number of open shards'
                    },
                    [dataRetention.logicalId]: {
                        default: 'Data retention period (hours)'
                    },
                    [enhancedMonitoring.logicalId]: {
                        default: 'Enable enhanced (shard-level) metrics'
                    },

                    [batchSize.logicalId]: {
                        default: 'Largest number of records that will be read from the stream at once'
                    },
                    [parallelization.logicalId]: {
                        default: 'Number of batches to process from each shard concurrently'
                    },
                    [retryAttempts.logicalId]: {
                        default: 'Maximum number of times to retry when the function returns an error'
                    }
                }
            }
        };

        //---------------------------------------------------------------------
        // Stack outputs

        new cdk.CfnOutput(this, 'ProxyApiId', {
            description: 'ID of the proxy API',
            value: apiGwToKds.apiGateway.restApiId
        });

        new cdk.CfnOutput(this, 'ProxyApiEndpoint', {
            description: 'Deployed URL of the proxy API',
            value: apiGwToKds.apiGateway.url
        });

        new cdk.CfnOutput(this, 'DataStreamName', {
            description: 'Name of the Amazon Kinesis Data stream',
            value: kds.Stream.streamName
        });

        new cdk.CfnOutput(this, 'LambdaConsumerArn', {
            description: 'ARN of the AWS Lambda function',
            value: kdsToLambda.lambdaFunction.functionArn
        });
    }
}
