/** ************************************************************************************************
*   Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.                             *
*   SPDX-License-Identifier: Apache-2.0                                                            *
 ************************************************************************************************ */


import * as cdk  from 'aws-cdk-lib';
import { aws_logs as cwlogs } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { FlinkStudio } from '../lib/kda-flink-studio';
import { FlinkLogLevels } from '../lib/kda-base';
import { KafkaMetadata } from '../lib/msk-custom-resource';
import { EncryptedBucket } from '../lib/s3-bucket';
import { SolutionHelper } from '../lib/solution-helper';
import { SolutionStackProps } from '../bin/solution-props';

export class MskKdaS3 extends cdk.Stack {
    constructor(scope: Construct, id: string, props: SolutionStackProps) {
        super(scope, id, props);

        //---------------------------------------------------------------------
        // Amazon MSK configuration
        const clusterArn = new cdk.CfnParameter(this, 'ClusterArn', {
            type: 'String',
            allowedPattern: 'arn:(aws[a-zA-Z0-9-]*):([a-zA-Z0-9\\-])+:([a-z]{2}(-gov)?-[a-z]+-\\d{1})?:(\\d{12})?:(.*)',
            constraintDescription: 'Cluster ARN must be in the following format: arn:${Partition}:kafka:${Region}:${Account}:cluster/${ClusterName}/${UUID}'
        });

        const kafkaHelper = new KafkaMetadata(this, 'Msk', {
            clusterArn: clusterArn.valueAsString
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

        const kda = new FlinkStudio(this, 'Kda', {
            logsRetentionDays: cwlogs.RetentionDays.ONE_YEAR,
            logLevel: logLevel.valueAsString,

            subnetIds: cdk.Token.asList(kafkaHelper.Subnets),
            securityGroupIds: cdk.Token.asList(kafkaHelper.SecurityGroups),

            clusterArn: clusterArn.valueAsString
        });

        outputBucket.Bucket.grantReadWrite(kda.ApplicationRole);

        //---------------------------------------------------------------------
        // Solution metrics
        new SolutionHelper(this, 'SolutionHelper', {
            solutionId: props.solutionId,
            pattern: MskKdaS3.name
        });

        //---------------------------------------------------------------------
        // Template metadata
        this.templateOptions.metadata = {
            'AWS::CloudFormation::Interface': {
                ParameterGroups: [
                    {
                        Label: { default: 'Amazon MSK configuration' },
                        Parameters: [clusterArn.logicalId]
                    },
                    {
                        Label: { default: 'Amazon Kinesis Data Analytics configuration' },
                        Parameters: [logLevel.logicalId]
                    }
                ],
                ParameterLabels: {
                    [clusterArn.logicalId]: {
                        default: 'ARN of the MSK cluster'
                    },
                    [logLevel.logicalId]: {
                        default: 'Verbosity of the CloudWatch Logs for the studio'
                    }
                }
            }
        };

        //---------------------------------------------------------------------
        // Stack outputs
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
