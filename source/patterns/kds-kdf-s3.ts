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
import * as iam from '@aws-cdk/aws-iam';
import * as firehose from '@aws-cdk/aws-kinesisfirehose';

import { DataStream } from '../lib/kds-data-stream';
import { EncryptedBucket } from '../lib/s3-bucket';
import { SolutionHelper } from '../lib/solution-helper';
import { SolutionStackProps } from './solution-props';
import { DeliveryStreamMonitoring } from '../lib/kdf-monitoring';

export class KdsKdfS3 extends cdk.Stack {
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
            maxValue: 168
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

        // TODO: Replace this section with aws-kinesisstreams-kinesisfirehose-s3 construct once available
        const firehoseRole = new iam.Role(this, 'Role', {
            assumedBy: new iam.ServicePrincipal('firehose.amazonaws.com'),
            inlinePolicies: {
                ReadSource: new iam.PolicyDocument({
                    statements: [new iam.PolicyStatement({
                        resources: [kds.Stream.streamArn],
                        actions: [
                            'kinesis:DescribeStream',
                            'kinesis:GetShardIterator',
                            'kinesis:GetRecords',
                            'kinesis:ListShards'
                        ]
                    })]
                })
            }
        });

        outputBucket.Bucket.grantWrite(firehoseRole);

        const deliveryStream = new firehose.CfnDeliveryStream(this, 'DeliveryStream', {
            deliveryStreamType: 'KinesisStreamAsSource',
            kinesisStreamSourceConfiguration: {
                kinesisStreamArn: kds.Stream.streamArn,
                roleArn: firehoseRole.roleArn
            },
            extendedS3DestinationConfiguration: {
                bucketArn: outputBucket.Bucket.bucketArn,
                roleArn: firehoseRole.roleArn,
                bufferingHints: {
                    intervalInSeconds: bufferingInterval.valueAsNumber,
                    sizeInMBs: bufferingSize.valueAsNumber
                },
                compressionFormat: compressionFormat.valueAsString,
                prefix: 'data/year=!{timestamp:yyyy}/month=!{timestamp:MM}/day=!{timestamp:dd}/hour=!{timestamp:HH}/',
                errorOutputPrefix: 'errors/year=!{timestamp:yyyy}/month=!{timestamp:MM}/day=!{timestamp:dd}/hour=!{timestamp:HH}/!{firehose:error-output-type}'
            }
        });

        //---------------------------------------------------------------------
        // Monitoring (dashboard and alarms) configuration

        new DeliveryStreamMonitoring(this, 'Monitoring', {
            dataStreamName: kds.Stream.streamName,
            deliveryStreamName: deliveryStream.ref,
            createLimitAlarms: false
        });

        //---------------------------------------------------------------------
        // Solution metrics

        new SolutionHelper(this, 'SolutionHelper', {
            solutionId: props.solutionId,
            pattern: KdsKdfS3.name,

            shardCount: shardCount.valueAsNumber,
            retentionHours: dataRetention.valueAsNumber,
            enhancedMonitoring: enhancedMonitoring.valueAsString,

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
                        Label: { default: 'Amazon Kinesis Data Streams configuration' },
                        Parameters: [shardCount.logicalId, dataRetention.logicalId, enhancedMonitoring.logicalId]
                    },
                    {
                        Label: { default: 'Amazon Kinesis Data Firehose configuration' },
                        Parameters: [bufferingSize.logicalId, bufferingInterval.logicalId, compressionFormat.logicalId]
                    }
                ],
                ParameterLabels: {
                    [shardCount.logicalId]: {
                        default: 'Number of open shards'
                    },
                    [dataRetention.logicalId]: {
                        default: 'Data retention period (hours)'
                    },
                    [enhancedMonitoring.logicalId]: {
                        default: 'Enable enhanced (shard-level) metrics'
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

        new cdk.CfnOutput(this, 'DataStreamName', {
            description: 'Name of the Kinesis stream',
            value: kds.Stream.streamName
        });

        new cdk.CfnOutput(this, 'DeliveryStreamName', {
            description: 'Name of the Firehose delivery stream',
            value: deliveryStream.ref
        });

        new cdk.CfnOutput(this, 'OutputBucketName', {
            description: 'Name of the S3 destination bucket',
            value: outputBucket.Bucket.bucketName
        });
    }
}
