/*********************************************************************************************************************
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.                                                *
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

import * as cdk  from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { aws_iam as iam, aws_s3 as s3, aws_kinesis as kinesis,  aws_kinesisfirehose as firehose} from 'aws-cdk-lib';
import { NagSuppressions } from 'cdk-nag';
import { EncryptedBucket } from './s3-bucket';

export interface DeliveryStreamProps {
    readonly inputDataStream: kinesis.Stream;
    readonly bufferingInterval: number;
    readonly bufferingSize: number;
    readonly compressionFormat: string;

    readonly dataPrefix: string;
    readonly errorsPrefix: string;

    readonly dynamicPartitioning: string;
    readonly newLineDelimiter: string;
    readonly jqExpression?: string;
    readonly retryDuration?: number;
}

export enum FeatureStatus {
    Enabled = 'Enabled',
    Disabled = 'Disabled'
}

export enum CompressionFormat {
    GZIP = 'GZIP',
    HADOOP_SNAPPY = 'HADOOP_SNAPPY',
    Snappy = 'Snappy',
    UNCOMPRESSED = 'UNCOMPRESSED',
    ZIP = 'ZIP'
}

export class DeliveryStream extends Construct {
    private readonly Output: EncryptedBucket;
    public readonly DeliveryStreamArn: string;
    public readonly DeliveryStreamName: string;

    public get OutputBucket(): s3.IBucket {
        return this.Output.Bucket;
    }

    constructor(scope: Construct, id: string, props: DeliveryStreamProps) {
        super(scope, id);

        const firehoseRole = new iam.Role(this, 'Role', {
            assumedBy: new iam.ServicePrincipal('firehose.amazonaws.com'),
            inlinePolicies: {
                ReadSource: new iam.PolicyDocument({
                    statements: [new iam.PolicyStatement({
                        resources: [props.inputDataStream.streamArn],
                        actions: [
                            'kinesis:DescribeStream',
                            'kinesis:DescribeStreamSummary',
                            'kinesis:GetShardIterator',
                            'kinesis:GetRecords',
                            'kinesis:ListShards',
                            'kinesis:SubscribeToShard'
                        ]
                    })]
                })
            }
        });

        this.Output = new EncryptedBucket(this, 'Output', {
            enableIntelligentTiering: true
        });

        this.OutputBucket.grantWrite(firehoseRole);

        const dpEnabledCondition = new cdk.CfnCondition(this, 'DynamicPartitioningEnabled', {
            expression: cdk.Fn.conditionEquals(props.dynamicPartitioning, FeatureStatus.Enabled)
        });

        const dpDisabledCondition = new cdk.CfnCondition(this, 'DynamicPartitioningDisabled', {
            expression: cdk.Fn.conditionEquals(props.dynamicPartitioning, FeatureStatus.Disabled)
        });

        const newLineCondition = new cdk.CfnCondition(this, 'NewLineDelimiter', {
            expression: cdk.Fn.conditionEquals(props.newLineDelimiter, FeatureStatus.Enabled)
        });

        const commonFirehoseProps = {
            deliveryStreamType: 'KinesisStreamAsSource',
            kinesisStreamSourceConfiguration: {
                kinesisStreamArn: props.inputDataStream.streamArn,
                roleArn: firehoseRole.roleArn
            }
        };

        const commonDestinationProps = {
            bucketArn: this.OutputBucket.bucketArn,
            roleArn: firehoseRole.roleArn,
            bufferingHints: {
                intervalInSeconds: props.bufferingInterval,
                sizeInMBs: props.bufferingSize
            },      
            compressionFormat: props.compressionFormat,
            prefix: props.dataPrefix,
            errorOutputPrefix: props.errorsPrefix
        }


        const kdfWithoutDP = new firehose.CfnDeliveryStream(this, 'DeliveryStreamWithoutDP', {
            ...commonFirehoseProps,
            extendedS3DestinationConfiguration: {
                ...commonDestinationProps
            }
        });

        NagSuppressions.addResourceSuppressions(kdfWithoutDP, [
            {
              id: "AwsSolutions-KDF1",
              reason: "Server-Side Encryption isn't supported on deliveryStreamType: KinesisStreamAsSource",
            }
          ]);

        const kdfWithDp = new firehose.CfnDeliveryStream(this, 'DeliveryStreamWithDP', {
            ...commonFirehoseProps,
            extendedS3DestinationConfiguration: {
                ...commonDestinationProps,
                dynamicPartitioningConfiguration: {
                    enabled: true,
                    retryOptions: {
                        durationInSeconds: props.retryDuration
                    }
                },
                processingConfiguration: {
                    enabled: true,
                    processors: [
                        {
                            type: 'MetadataExtraction',
                            parameters: [
                                {
                                    parameterName: 'MetadataExtractionQuery',
                                    parameterValue: props.jqExpression!
                                },
                                {
                                    parameterName: 'JsonParsingEngine',
                                    parameterValue: 'JQ-1.6'
                                }
                            ]
                        },
                        {
                            type: 'AppendDelimiterToRecord',
                            parameters: [{
                                parameterName: 'Delimiter',
                                parameterValue: cdk.Fn.conditionIf(newLineCondition.logicalId, '\\n', '').toString()
                            }]
                        }
                        // Other processors can be added here as well.
                        // For instance, if multi record deaggregation needs to be enabled, you can umcomment the following code:
                        /*
                        {
                            type: 'RecordDeAggregation',
                            parameters: [{
                                parameterName: 'SubRecordType',
                                parameterValue: 'JSON'
                            }]
                        }
                        */
                    ]
                }
            }
        });

        NagSuppressions.addResourceSuppressions(kdfWithDp, [
            {
              id: "AwsSolutions-KDF1",
              reason: "Server-Side Encryption isn't supported on deliveryStreamType: KinesisStreamAsSource",
            }
          ]);

        kdfWithoutDP.cfnOptions.condition = dpDisabledCondition;
        kdfWithDp.cfnOptions.condition = dpEnabledCondition;

        this.DeliveryStreamArn = cdk.Fn.conditionIf(
            dpEnabledCondition.logicalId,
            kdfWithDp.getAtt('Arn'),
            kdfWithoutDP.getAtt('Arn')
        ).toString();

        this.DeliveryStreamName = cdk.Fn.conditionIf(
            dpEnabledCondition.logicalId,
            kdfWithDp.ref,
            kdfWithoutDP.ref
        ).toString();
    }
}
