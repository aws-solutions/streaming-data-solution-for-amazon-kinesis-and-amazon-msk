/** ************************************************************************************************
*   Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.                             *
*   SPDX-License-Identifier: Apache-2.0                                                            *
 ************************************************************************************************ */

import * as cdk  from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { DataStream } from '../lib/kds-data-stream';
import { DeliveryStream, CompressionFormat, FeatureStatus } from '../lib/kdf-delivery-stream';
import { SolutionHelper } from '../lib/solution-helper';
import { SolutionStackProps } from '../bin/solution-props';
import { DeliveryStreamMonitoring } from '../lib/kdf-monitoring';

export class KdsKdfS3 extends cdk.Stack {
    constructor(scope: Construct, id: string, props: SolutionStackProps) {
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
            default: CompressionFormat.GZIP,
            allowedValues: Object.values(CompressionFormat)
        });

        const dataPrefix = new cdk.CfnParameter(this, 'DataPrefix', {
            type: 'String',
            minLength: 0,
            maxLength: 1024,
            default: 'data/year=!{timestamp:yyyy}/month=!{timestamp:MM}/day=!{timestamp:dd}/hour=!{timestamp:HH}/'
        });

        const errorsPrefix = new cdk.CfnParameter(this, 'ErrorsPrefix', {
            type: 'String',
            minLength: 0,
            maxLength: 1024,
            default: 'errors/year=!{timestamp:yyyy}/month=!{timestamp:MM}/day=!{timestamp:dd}/hour=!{timestamp:HH}/!{firehose:error-output-type}'
        });

        //---------------------------------------------------------------------
        // Dynamic partitioning configuration
        const dynamicPartitioning = new cdk.CfnParameter(this, 'DynamicPartitioning', {
            type: 'String',
            default: FeatureStatus.Disabled,
            allowedValues: Object.values(FeatureStatus)
        });

        const newLineDelimiter = new cdk.CfnParameter(this, 'NewLineDelimiter', {
            type: 'String',
            default: FeatureStatus.Disabled,
            allowedValues: Object.values(FeatureStatus)
        });

        const jqExpression = new cdk.CfnParameter(this, 'JqExpression', {
            type: 'String',
            maxLength: 4096
        });

        const retryDuration = new cdk.CfnParameter(this, 'RetryDurationSec', {
            type: 'Number',
            default: 300,
            minValue: 0,
            maxValue: 7200
        });

        const kdf = new DeliveryStream(this, 'Kdf', {
            inputDataStream: kds.Stream,

            bufferingInterval: bufferingInterval.valueAsNumber,
            bufferingSize: bufferingSize.valueAsNumber,
            compressionFormat: compressionFormat.valueAsString,

            dataPrefix: dataPrefix.valueAsString,
            errorsPrefix: errorsPrefix.valueAsString,

            dynamicPartitioning: dynamicPartitioning.valueAsString,
            newLineDelimiter: newLineDelimiter.valueAsString,
            jqExpression: jqExpression.valueAsString,
            retryDuration: retryDuration.valueAsNumber
        });

        //---------------------------------------------------------------------
        // Monitoring (dashboard and alarms) configuration
        new DeliveryStreamMonitoring(this, 'Monitoring', {
            dataStreamName: kds.Stream.streamName,
            deliveryStreamName: kdf.DeliveryStreamArn,
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
                        Parameters: [
                            bufferingSize.logicalId,
                            bufferingInterval.logicalId,
                            compressionFormat.logicalId,
                            dataPrefix.logicalId,
                            errorsPrefix.logicalId
                        ]
                    },
                    {
                        Label: { default: 'Dynamic partitioning configuration' },
                        Parameters: [
                            dynamicPartitioning.logicalId,
                            newLineDelimiter.logicalId,
                            jqExpression.logicalId,
                            retryDuration.logicalId
                        ]
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
                        default: 'Size of the buffer (in MBs) that incoming data is buffered before delivery (if dynamic partitioning is enabled, this value must be between 64 MiB and 128 MiB)'
                    },
                    [bufferingInterval.logicalId]: {
                        default: 'Length of time (in seconds) that incoming data is buffered before delivery'
                    },
                    [compressionFormat.logicalId]: {
                        default: 'Compression format for delivered data in Amazon S3'
                    },
                    [dataPrefix.logicalId]: {
                        default: 'Prefix to be appended to the data delivered to Amazon S3 (if dynamic partitioning is enabled, you can specify the "partitionKeyFromQuery" namespace as well)'
                    },
                    [errorsPrefix.logicalId]: {
                        default: 'Prefix to be used for errors when delivering data (if dynamic partitioning is enabled, this parameter is required)'
                    },

                    [dynamicPartitioning.logicalId]: {
                        default: 'Whether data on Amazon S3 will be partitioned (once enabled, dynamic partitioning cannot be disabled)'
                    },
                    [newLineDelimiter.logicalId]: {
                        default: 'Whether to add a new line delimiter between records'
                    },
                    [jqExpression.logicalId]: {
                        default: 'JQ expression (for example, "{ ticker: .ticker }")'
                    },
                    [retryDuration.logicalId]: {
                        default: 'Total amount of time (in seconds) that should be spent on retries'
                    }
                }
            }
        };

        //---------------------------------------------------------------------
        // Stack outputs
        new cdk.CfnOutput(this, 'DataStreamName', {
            description: 'Name of the Amazon Kinesis Data stream',
            value: kds.Stream.streamName
        });

        new cdk.CfnOutput(this, 'DeliveryStreamName', {
            description: 'Name of the Amazon Kinesis Data Firehose delivery stream',
            value: kdf.DeliveryStreamName
        });

        new cdk.CfnOutput(this, 'OutputBucketName', {
            description: 'Name of the Amazon S3 destination bucket',
            value: kdf.OutputBucket.bucketName
        });
    }
}
