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
import * as logs from '@aws-cdk/aws-logs';

import { SolutionHelper } from '../lib/solution-helper';
import { SolutionStackProps } from './solution-props';
import { EncryptedBucket } from '../lib/s3-bucket';
import { KafkaConsumer } from '../lib/msk-consumer';
import { KinesisFirehoseToS3 } from '@aws-solutions-constructs/aws-kinesisfirehose-s3';

export class MskLambdaKdf extends cdk.Stack {
    constructor(scope: cdk.Construct, id: string, props: SolutionStackProps) {
        super(scope, id, props);

        //---------------------------------------------------------------------
        // Kinesis Data Firehose configuration

        const bufferingSize = new cdk.CfnParameter(this, 'BufferingSize', {
            type: 'Number',
            default: 5,
            minValue: 1,
            maxValue: 128
        });

        const bufferingInterval = new cdk.CfnParameter(this, 'BufferingInterval', {
            type: 'Number',
            default: 300,
            minValue: 60,
            maxValue: 900
        });

        const compressionFormat = new cdk.CfnParameter(this, 'CompressionFormat', {
            type: 'String',
            default: 'GZIP',
            allowedValues: ['GZIP', 'HADOOP_SNAPPY', 'Snappy', 'UNCOMPRESSED', 'ZIP']
        });

        const outputBucket = new EncryptedBucket(this, 'Output', {
            enableIntelligentTiering: true
        });

        const kdfToS3 = new KinesisFirehoseToS3(this, 'KdfToS3', {
            existingBucketObj: outputBucket.Bucket,
            kinesisFirehoseProps: {
                deliveryStreamType: 'DirectPut',
                deliveryStreamEncryptionConfigurationInput: {
                    keyType: 'AWS_OWNED_CMK'
                },
                extendedS3DestinationConfiguration: {
                    bufferingHints: {
                        intervalInSeconds: bufferingInterval.valueAsNumber,
                        sizeInMBs: bufferingSize.valueAsNumber
                    },
                    compressionFormat: compressionFormat.valueAsString,
                    prefix: 'data/year=!{timestamp:yyyy}/month=!{timestamp:MM}/day=!{timestamp:dd}/hour=!{timestamp:HH}/',
                    errorOutputPrefix: 'errors/year=!{timestamp:yyyy}/month=!{timestamp:MM}/day=!{timestamp:dd}/hour=!{timestamp:HH}/!{firehose:error-output-type}'
                }
            }
        });

        (kdfToS3.node.findChild('firehose-log-group').node.defaultChild as logs.CfnLogGroup).cfnOptions.metadata = {
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
            code: lambda.Code.fromAsset('lambda/msk-lambda-kdf'),
            timeout: cdk.Duration.minutes(5),
            environmentVariables: {
                'DELIVERY_STREAM_NAME': kdfToS3.kinesisFirehose.ref
            }
        });

        lambdaConsumer.Function.role?.addToPrincipalPolicy(new iam.PolicyStatement({
            actions: ['firehose:PutRecord', 'firehose:PutRecordBatch'],
            resources: [kdfToS3.kinesisFirehose.getAtt('Arn').toString()],
        }));

        //---------------------------------------------------------------------
        // Solution metrics
        new SolutionHelper(this, 'SolutionHelper', {
            solutionId: props.solutionId,
            pattern: MskLambdaKdf.name,

            bufferingSize: bufferingSize.valueAsNumber,
            bufferingInterval: bufferingInterval.valueAsNumber,
            compressionFormat: compressionFormat.valueAsString
        });

        //---------------------------------------------------------------------
        // Template metadata

        this.templateOptions.metadata = {
            'AWS::CloudFormation::Interface': {
                ParameterGroups: [
                    {
                        Label: { default: 'AWS Lambda consumer configuration' },
                        Parameters: [clusterArn.logicalId, batchSize.logicalId, topicName.logicalId]
                    },
                    {
                        Label: { default: 'Amazon Kinesis Data Firehose configuration' },
                        Parameters: [bufferingSize.logicalId, bufferingInterval.logicalId, compressionFormat.logicalId]
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

                    [bufferingSize.logicalId]: {
                        default: 'Size of the buffer (in MBs) that incoming data is buffered before delivery'
                    },
                    [bufferingInterval.logicalId]: {
                        default: 'Length of time (in seconds) that incoming data is buffered before delivery'
                    },
                    [compressionFormat.logicalId]: {
                        default: 'Compression format for delivered data in Amazon S3'
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
            description: 'Identifier for AWS Lambda event source mapping',
            value: lambdaConsumer.EventMapping.eventSourceMappingId
        });

        new cdk.CfnOutput(this, 'DeliveryStreamName', {
            description: 'Name of the Amazon Kinesis Data Firehose delivery stream',
            value: kdfToS3.kinesisFirehose.ref
        });

        new cdk.CfnOutput(this, 'OutputBucketName', {
            description: 'Name of the Amazon S3 destination bucket',
            value: outputBucket.Bucket.bucketName
        });
    }
}
