/** ************************************************************************************************
*   Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.                             *
*   SPDX-License-Identifier: Apache-2.0                                                            *
 ************************************************************************************************ */


import * as cdk  from 'aws-cdk-lib';
import { aws_logs as cwlogs } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { DataStream } from '../lib/kds-data-stream';
import { KinesisProducer } from '../lib/kpl-producer';
import { FlinkStudio } from '../lib/kda-flink-studio';
import { FlinkLogLevels } from '../lib/kda-base';
import { EncryptedBucket } from '../lib/s3-bucket';
import { SolutionHelper } from '../lib/solution-helper';
import { SolutionStackProps } from '../bin/solution-props';
import { ApplicationMonitoring } from '../lib/kda-monitoring';

export class KplKdsKda extends cdk.Stack {
    private readonly BinaryOptions = ['true', 'false'];

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
            allowedValues: this.BinaryOptions
        });

        const kds = new DataStream(this, 'Kds', {
            shardCount: shardCount.valueAsNumber,
            retentionPeriod: cdk.Duration.hours(dataRetention.valueAsNumber),
            enableEnhancedMonitoring: enhancedMonitoring.valueAsString
        });

        //---------------------------------------------------------------------
        // Kinesis Producer Library configuration
        const producerVpc = new cdk.CfnParameter(this, 'ProducerVpcId', {
            type: 'AWS::EC2::VPC::Id'
        });

        const producerSubnet = new cdk.CfnParameter(this, 'ProducerSubnetId', {
            type: 'AWS::EC2::Subnet::Id'
        });

        const producerAmiId = new cdk.CfnParameter(this, 'ProducerAmiId', {
            type: 'AWS::SSM::Parameter::Value<AWS::EC2::Image::Id>',
            default: '/aws/service/ami-amazon-linux-latest/amzn2-ami-hvm-x86_64-gp2'
        });

        const kpl = new KinesisProducer(this, 'Kpl', {
            stream: kds.Stream,
            vpcId: producerVpc.valueAsString,
            subnetId: producerSubnet.valueAsString,
            imageId: producerAmiId.valueAsString,
            codeBucketName: cdk.Fn.join('-', ['%%BUCKET_NAME%%', cdk.Aws.REGION]),
            codeFileKey: cdk.Fn.join('/', ['%%SOLUTION_NAME%%/%%VERSION%%', 'kpl-demo.zip'])
        });

        //---------------------------------------------------------------------
        // Kinesis Data Analytics configuration
        const outputBucket = new EncryptedBucket(this, 'Output', {
            enableIntelligentTiering: true
        });

        const logLevel = new cdk.CfnParameter(this, 'LogLevel', {
            type: 'String',
            default: FlinkLogLevels.INFO,
            allowedValues: Object.values(FlinkLogLevels)
        });

        const subnets = new cdk.CfnParameter(this, 'ApplicationSubnetIds', {
            type: 'CommaDelimitedList'
        });

        const securityGroups = new cdk.CfnParameter(this, 'ApplicationSecurityGroupIds', {
            type: 'CommaDelimitedList'
        });

        const kda = new FlinkStudio(this, 'Kda', {
            logsRetentionDays: cwlogs.RetentionDays.ONE_YEAR,
            logLevel: logLevel.valueAsString,

            subnetIds: subnets.valueAsList,
            securityGroupIds: securityGroups.valueAsList
        });

        kds.Stream.grantRead(kda.ApplicationRole);
        outputBucket.Bucket.grantReadWrite(kda.ApplicationRole);

        //---------------------------------------------------------------------
        // Solution metrics
        new SolutionHelper(this, 'SolutionHelper', {
            solutionId: props.solutionId,
            pattern: KplKdsKda.name,

            shardCount: shardCount.valueAsNumber,
            retentionHours: dataRetention.valueAsNumber,
            enhancedMonitoring: enhancedMonitoring.valueAsString
        });

        //---------------------------------------------------------------------
        // Monitoring (dashboard and alarms) configuration
        new ApplicationMonitoring(this, 'Monitoring', {
            applicationName: kda.ApplicationName,
            logGroupName: kda.LogGroupName,
            inputStreamName: kds.Stream.streamName
        });

        //---------------------------------------------------------------------
        // Template metadata
        this.templateOptions.metadata = {
            'AWS::CloudFormation::Interface': {
                ParameterGroups: [
                    {
                        Label: { default: 'Amazon Kinesis Producer Library (KPL) configuration' },
                        Parameters: [producerVpc.logicalId, producerSubnet.logicalId, producerAmiId.logicalId]
                    },
                    {
                        Label: { default: 'Amazon Kinesis Data Streams configuration' },
                        Parameters: [shardCount.logicalId, dataRetention.logicalId, enhancedMonitoring.logicalId]
                    },
                    {
                        Label: { default: 'Amazon Kinesis Data Analytics configuration' },
                        Parameters: [
                            logLevel.logicalId,
                            subnets.logicalId,
                            securityGroups.logicalId
                        ]
                    }
                ],
                ParameterLabels: {
                    [producerVpc.logicalId]: {
                        default: 'VPC where the KPL instance should be launched'
                    },
                    [producerSubnet.logicalId]: {
                        default: 'Subnet where the KPL instance should be launched (needs access to Kinesis - either via IGW or NAT)'
                    },
                    [producerAmiId.logicalId]: {
                        default: 'Amazon Machine Image for the KPL instance'
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

                    [logLevel.logicalId]: {
                        default: 'Verbosity of the CloudWatch Logs for the studio'
                    },
                    [subnets.logicalId]: {
                        default: '(Optional) Comma-separated list of subnet ids for VPC connectivity (if informed, requires security groups to be included as well)'
                    },
                    [securityGroups.logicalId]: {
                        default: '(Optional) Comma-separated list of security groups ids for VPC connectivity (if informed, requires subnets to be included as well)'
                    }
                }
            }
        };

        //---------------------------------------------------------------------
        // Stack outputs
        new cdk.CfnOutput(this, 'ProducerInstance', {
            description: 'ID of the KPL Amazon EC2 instance',
            value: kpl.InstanceId
        });

        new cdk.CfnOutput(this, 'DataStreamName', {
            description: 'Name of the Amazon Kinesis Data stream',
            value: kds.Stream.streamName
        });

        new cdk.CfnOutput(this, 'StudioNotebookName', {
            description: 'Name of the Amazon Kinesis Data Analytics Studio notebook',
            value: kda.ApplicationName
        });

        new cdk.CfnOutput(this, 'OutputBucketName', {
            description: 'Name of the Amazon S3 destination bucket',
            value: outputBucket.Bucket.bucketName
        });
    }
}
