/** ************************************************************************************************
*   Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.                             *
*   SPDX-License-Identifier: Apache-2.0                                                            *
 ************************************************************************************************ */

import * as cdk  from 'aws-cdk-lib';
import { aws_iam as iam, aws_s3 as s3 } from 'aws-cdk-lib';
import { Construct } from 'constructs';

import { CfnNagHelper } from '../lib/cfn-nag-helper';
import { SolutionHelper } from '../lib/solution-helper';
import { SolutionStackProps } from '../bin/solution-props';

export class MskLambdaRoleStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props: SolutionStackProps) {
        super(scope, id, props);

        const ec2Role = new iam.Role(this, 'EC2Role', {
            assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com')
        });

        const assetsBucket = s3.Bucket.fromBucketName(this, 'AssetsBucket', 'reinvent2019-msk-liftandshift');

        const policy = new iam.Policy(this, 'KafkaClientEC2InstancePolicy', {
            statements: [
                new iam.PolicyStatement({
                    sid: 'S3AssetsPolicy',
                    effect: iam.Effect.ALLOW,
                    actions: ['s3:GetObject', 's3:ListBucket'],
                    resources: [assetsBucket.bucketArn, assetsBucket.arnForObjects('*')]
                }),

                new iam.PolicyStatement({
                    sid: 'MskMetadataPolicy',
                    effect: iam.Effect.ALLOW,
                    actions: ['kafka:DescribeCluster', 'kafka:GetBootstrapBrokers'],
                    resources: ['*']
                }),

                new iam.PolicyStatement({
                    sid: 'CloudFormationStacksPolicy',
                    effect: iam.Effect.ALLOW,
                    actions: ['cloudformation:DescribeStacks'],
                    resources: [`arn:${cdk.Aws.PARTITION}:cloudformation:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:stack/*/*`]
                }),

                new iam.PolicyStatement({
                    sid: 'ProducerGluePolicy',
                    effect: iam.Effect.ALLOW,
                    actions: [
                        'glue:CreateSchema',
                        'glue:GetSchemaByDefinition',
                        'glue:RegisterSchemaVersion'
                    ],
                    resources: [
                        `arn:${cdk.Aws.PARTITION}:glue:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:registry/default-registry`,
                        `arn:${cdk.Aws.PARTITION}:glue:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:schema/*`
                    ]
                }),

                /*
                    There are some assumptions in the policies below (from https://github.com/aws-samples/integration-sample-lambda-msk):
                        - The SAM bucket will be named `lambda-artifacts-[random-value]`
                        - The CloudFormation stack will be named `MSKToS3` (and some resources will have that as a prefix)
                */

                new iam.PolicyStatement({
                    sid: 'SamS3Policy',
                    effect: iam.Effect.ALLOW,
                    actions: [
                        's3:CreateBucket',
                        's3:DeleteBucket',
                        's3:DeleteObject',
                        's3:GetObject',
                        's3:ListBucket',
                        's3:PutObject'
                    ],
                    resources: [
                        `arn:${cdk.Aws.PARTITION}:s3:::lambda-artifacts-*`,
                        `arn:${cdk.Aws.PARTITION}:s3:::msktos3-*`,
                        `arn:${cdk.Aws.PARTITION}:s3:::lambda-artifacts-*/*`,
                        `arn:${cdk.Aws.PARTITION}:s3:::msktos3-*/*`,
                    ]
                }),

                new iam.PolicyStatement({
                    sid: 'SamCloudFormationPolicy',
                    effect: iam.Effect.ALLOW,
                    actions: [
                        'cloudformation:CreateChangeSet',
                        'cloudformation:DeleteStack',
                        'cloudformation:DescribeChangeSet',
                        'cloudformation:DescribeStackEvents',
                        'cloudformation:DescribeStackResource',
                        'cloudformation:ExecuteChangeSet',
                        'cloudformation:GetTemplateSummary',
                        'cloudformation:ListStackResources',
                        'cloudformation:UpdateStack'
                    ],
                    resources: [
                        `arn:${cdk.Aws.PARTITION}:cloudformation:${cdk.Aws.REGION}:aws:transform/Serverless-2016-10-31`,
                        `arn:${cdk.Aws.PARTITION}:cloudformation:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:stack/MSKToS3/*`,
                    ]
                }),

                new iam.PolicyStatement({
                    sid: 'LambdaMappingPolicy',
                    effect: iam.Effect.ALLOW,
                    actions: [
                        'lambda:CreateEventSourceMapping',
                        'lambda:DeleteEventSourceMapping',
                        'lambda:GetEventSourceMapping',
                        'lambda:ListEventSourceMappings'
                    ],
                    resources: ['*']
                }),

                new iam.PolicyStatement({
                    sid: 'LambdaVpcPolicy',
                    effect: iam.Effect.ALLOW,
                    actions: [
                        'ec2:DescribeNetworkInterfaces',
                        'ec2:DescribeVpcs',
                        'ec2:DescribeSubnets',
                        'ec2:DescribeSecurityGroups'
                    ],
                    resources: ['*']
                }),

                new iam.PolicyStatement({
                    sid: 'CloudFormationResourcesPolicy',
                    effect: iam.Effect.ALLOW,
                    actions: [
                        'ec2:CreateNetworkInterface',
                        'ec2:DeleteNetworkInterface',
                        'firehose:CreateDeliveryStream',
                        'firehose:DeleteDeliveryStream',
                        'firehose:DescribeDeliveryStream',
                        'iam:AttachRolePolicy',
                        'iam:CreateRole',
                        'iam:DeleteRole',
                        'iam:DeleteRolePolicy',
                        'iam:DetachRolePolicy',
                        'iam:GetRole',
                        'iam:GetRolePolicy',
                        'iam:PassRole',
                        'iam:PutRolePolicy',
                        'lambda:CreateFunction',
                        'lambda:DeleteFunction',
                        'lambda:GetFunction',
                        'logs:DeleteLogGroup'
                    ],
                    resources: [
                        `arn:${cdk.Aws.PARTITION}:ec2:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:network-interface/*`,
                        `arn:${cdk.Aws.PARTITION}:ec2:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:security-group/*`,
                        `arn:${cdk.Aws.PARTITION}:ec2:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:subnet/*`,
                        `arn:${cdk.Aws.PARTITION}:iam::${cdk.Aws.ACCOUNT_ID}:role/MSKToS3-*`,
                        `arn:${cdk.Aws.PARTITION}:firehose:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:deliverystream/MSKToS3-*`,
                        `arn:${cdk.Aws.PARTITION}:lambda:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:function:MSKToS3-*`,
                        `arn:${cdk.Aws.PARTITION}:logs:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:log-group:/aws/lambda/MSKToS3-*`
                    ]
                })
            ]
        });

        policy.attachToRole(ec2Role);

        CfnNagHelper.addSuppressions(
            policy.node.defaultChild as iam.CfnPolicy,
            [
                {
                    Id: 'W12',
                    Reason: 'Some actions do not support resource level permissions'
                },
                {
                    Id: 'W76',
                    Reason: 'SPCM is higher than 25 since role is used for several tasks during a lab'
                }
            ]
        );

        //---------------------------------------------------------------------
        // Solution metrics
        new SolutionHelper(this, 'SolutionHelper', {
            solutionId: props.solutionId,
            pattern: MskLambdaRoleStack.name
        });

        //---------------------------------------------------------------------
        // Outputs
        new cdk.CfnOutput(this, 'KafkaClientEC2Role', {
            value: ec2Role.roleName,
            description: 'IAM role for the EC2 instance',
            exportName: `${cdk.Aws.STACK_NAME}-KafkaClientEC2Role`
        });
    }
}
