/** ************************************************************************************************
*   Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.                             *
*   SPDX-License-Identifier: Apache-2.0                                                            *
 ************************************************************************************************ */

import * as cdk  from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { SolutionHelper } from '../lib/solution-helper';
import { SolutionStackProps } from '../bin/solution-props';

export class MskConnectS3 extends cdk.Stack {
    constructor(scope: Construct, id: string, props: SolutionStackProps) {
        super(scope, id, props);

        //---------------------------------------------------------------------
        // Amazon MSK configuration
        const clusterArn = new cdk.CfnParameter(this, 'ClusterArn', {
            type: 'String',
            allowedPattern: 'arn:(aws[a-zA-Z0-9-]*):([a-zA-Z0-9\\-])+:([a-z]{2}(-gov)?-[a-z]+-\\d{1})?:(\\d{12})?:(.*)',
            constraintDescription: 'Cluster ARN must be in the following format: arn:${Partition}:kafka:${Region}:${Account}:cluster/${ClusterName}/${UUID}'
        });

        const topicName = new cdk.CfnParameter(this, 'TopicName', {
            type: 'String',
            allowedPattern: '.+',
            constraintDescription: 'Topic name must not be empty'
        });

        //---------------------------------------------------------------------
        // Connect capacity configuration
        const minNumberOfWorkers = new cdk.CfnParameter(this, 'MinWorkerCount', {
            type: 'Number',
            default: 1,
            minValue: 1,
            maxValue: 10
        });

        const maxNumberOfWorkers = new cdk.CfnParameter(this, 'MaxWorkerCount', {
            type: 'Number',
            default: 2,
            minValue: 2,
            maxValue: 10
        });

        const mcuCount = new cdk.CfnParameter(this, 'McuCount', {
            type: 'Number',
            default: 1,
            allowedValues: ['1', '2', '4', '8']
        });

        const scaleInPercentage = new cdk.CfnParameter(this, 'ScaleInPercentage', {
            type: 'Number',
            default: 20,
            minValue: 1,
            maxValue: 100
        });

        const scaleOutPercentage = new cdk.CfnParameter(this, 'ScaleOutPercentage', {
            type: 'Number',
            default: 80,
            minValue: 11,
            maxValue: 100
        });

        //---------------------------------------------------------------------
        // Connect connector configuration
        const numberOfTasks = new cdk.CfnParameter(this, 'NumberOfTasks', {
            type: 'Number',
            default: 2,
            minValue: 1
        });

        const flushSize = new cdk.CfnParameter(this, 'FlushSize', {
            type: 'Number',
            default: 1,
            minValue: 1
        });

        //---------------------------------------------------------------------
        // Template metadata
        this.templateOptions.metadata = {
            'AWS::CloudFormation::Interface': {
                ParameterGroups: [
                    {
                        Label: { default: 'Amazon MSK configuration' },
                        Parameters: [clusterArn.logicalId, topicName.logicalId]
                    },
                    {
                        Label: { default: 'MSK Connect capacity configuration' },
                        Parameters: [
                            mcuCount.logicalId,
                            minNumberOfWorkers.logicalId,
                            maxNumberOfWorkers.logicalId,
                            scaleInPercentage.logicalId,
                            scaleOutPercentage.logicalId
                        ]
                    },
                    {
                        Label: { default: 'MSK Connect connector configuration' },
                        Parameters: [numberOfTasks.logicalId, flushSize.logicalId]
                    }
                ],
                ParameterLabels: {
                    [clusterArn.logicalId]: {
                        default: 'ARN of the MSK cluster'
                    },
                    [topicName.logicalId]: {
                        default: 'Name of a Kafka topic to consume (topic must already exist before the stack is launched)'
                    },

                    [mcuCount.logicalId]: {
                        default: 'Number of MSK Connect Units (MCUs) per worker (each MCU provides 1 vCPU of compute and 4 GiB of memory)'
                    },
                    [minNumberOfWorkers.logicalId]: {
                        default: 'Minimum number of workers'
                    },
                    [maxNumberOfWorkers.logicalId]: {
                        default: 'Maximum number of workers'
                    },
                    [scaleInPercentage.logicalId]: {
                        default: 'Scale-In utilization %'
                    },
                    [scaleOutPercentage.logicalId]: {
                        default: 'Scale-Out utilization %'
                    },

                    [numberOfTasks.logicalId]: {
                        default: 'Maximum number of tasks to be created'
                    },
                    [flushSize.logicalId]: {
                        default: 'Number of records written to each S3 object'
                    }
                }
            }
        };

        //---------------------------------------------------------------------
        // Solution metrics
        new SolutionHelper(this, 'SolutionHelper', {
            solutionId: props.solutionId,
            pattern: MskConnectS3.name
        });
    }
}