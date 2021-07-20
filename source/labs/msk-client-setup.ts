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
import * as cfninc from '@aws-cdk/cloudformation-include';
import * as cloud9 from '@aws-cdk/aws-cloud9';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as iam from '@aws-cdk/aws-iam';
import * as lambda from '@aws-cdk/aws-lambda';

import { CfnNagHelper } from '../lib/cfn-nag-helper';
import { SolutionHelper } from '../lib/solution-helper';
import { SolutionStackProps } from '../bin/solution-props';
import { ExecutionRole } from '../lib/lambda-role-cloudwatch';

export class MskClientStack extends cdk.Stack {
    constructor(scope: cdk.Construct, id: string, props: SolutionStackProps) {
        super(scope, id, props);

        const keyPair = new cdk.CfnParameter(this, 'KeyPair', {
            type: 'AWS::EC2::KeyPair::KeyName'
        });

        const latestAmiId = new cdk.CfnParameter(this, 'LatestAmiId', {
            type: 'AWS::SSM::Parameter::Value<AWS::EC2::Image::Id>',
            default: '/aws/service/ami-amazon-linux-latest/amzn2-ami-hvm-x86_64-gp2'
        });

        const userDataLocation = new cdk.CfnParameter(this, 'UserDataLocation', {
            type: 'String',
            default: 'https://github.com/aws-samples/lab-resources-for-amazon-msk'
        });

        const setupScript = new cdk.CfnParameter(this, 'SetupScript', {
            type: 'String',
            default: './setup.sh'
        });

        const roleName = new cdk.CfnParameter(this, 'RoleName', {
            type: 'String',
            allowedPattern: '.+',
            constraintDescription: 'Role name must not be empty'
        });

        //---------------------------------------------------------------------
        // Template metadata
        this.templateOptions.metadata = {
            'AWS::CloudFormation::Interface': {
                ParameterGroups: [
                    {
                        Label: { default: 'Amazon EC2 client configuration' },
                        Parameters: [
                            keyPair.logicalId,
                            latestAmiId.logicalId,
                            userDataLocation.logicalId,
                            setupScript.logicalId,
                            roleName.logicalId
                        ]
                    }
                ],
                ParameterLabels: {
                    [keyPair.logicalId]: {
                        default: 'Name of an existing key pair to enable SSH access to the instance'
                    },
                    [latestAmiId.logicalId]: {
                        default: 'Amazon Machine Image for the instance'
                    },
                    [userDataLocation.logicalId]: {
                        default: 'Git repository where the user data configuration is stored (default branch will be used)'
                    },
                    [setupScript.logicalId]: {
                        default: 'Path of the shell script to be executed when the instance launches'
                    },
                    [roleName.logicalId]: {
                        default: 'Name of an existing IAM role to associate with the instance'
                    }
                }
            }
        };

        //---------------------------------------------------------------------
        // MSK VPC
        const mskVpc = new cfninc.CfnInclude(this, 'MSKVPCStack', {
            templateFile: 'labs/templates/MSKPrivateVPCOnly.yml'
        });

        //---------------------------------------------------------------------
        // Cloud9 custom resource
        const executionRole = new ExecutionRole(this, 'CustomResourceRole', {
            inlinePolicyName: 'Cloud9IAM',
            inlinePolicyDocument: new iam.PolicyDocument({
                statements: [
                    new iam.PolicyStatement({
                        actions: [
                            'iam:AddRoleToInstanceProfile',
                            'iam:AttachRolePolicy',
                            'iam:CreateInstanceProfile',
                            'iam:CreateRole',
                            'iam:GetInstanceProfile',
                            'iam:GetRole',

                            // Even though PassRole is not used directly, it's required by AddRoleToInstanceProfile
                            'iam:PassRole'
                        ],
                        resources: [
                            `arn:${cdk.Aws.PARTITION}:iam::${cdk.Aws.ACCOUNT_ID}:role/service-role/AWSCloud9SSMAccessRole`,
                            `arn:${cdk.Aws.PARTITION}:iam::${cdk.Aws.ACCOUNT_ID}:instance-profile/cloud9/AWSCloud9SSMInstanceProfile`
                        ],
                        effect: iam.Effect.ALLOW
                    })
                ]
            })
        });

        const cloud9Setup = new lambda.Function(this, 'CustomResource', {
            runtime: lambda.Runtime.PYTHON_3_8,
            handler: 'lambda_function.handler',
            description: 'This function creates prerequisite resources for Cloud9 (such as IAM roles)',
            code: lambda.Code.fromAsset('lambda/cloud9-setup'),
            timeout: cdk.Duration.minutes(1),
            role: executionRole.Role
        });

        const cloud9CR = new cdk.CustomResource(this, 'Cloud9Helper', {
            serviceToken: cloud9Setup.functionArn,
            resourceType: 'Custom::Cloud9Setup'
        });

        //---------------------------------------------------------------------
        // Cloud9 environment
        const cloud9Env = new cloud9.CfnEnvironmentEC2(this, 'Cloud9EC2', {
            automaticStopTimeMinutes: 600,
            connectionType: 'CONNECT_SSM',
            description: 'Cloud9 EC2 environment',
            instanceType: 'm5.large',
            imageId: 'amazonlinux-2-x86_64',
            name: `${cdk.Aws.STACK_NAME}-Cloud9EC2Bastion`,
            subnetId: cdk.Fn.ref('PublicSubnetOne'),
            tags: [{
                key: 'Purpose',
                value: 'Cloud9EC2BastionHostInstance'
            }]
        });

        cloud9Env.node.addDependency(cloud9CR);

        //---------------------------------------------------------------------
        // MSK client instance
        const kafkaClientSG = new ec2.CfnSecurityGroup(this, 'KafkaClientInstanceSecurityGroup', {
            vpcId: cdk.Fn.ref('VPC'),
            groupDescription: 'EC2 Client Security Group',
            securityGroupIngress: [{
                ipProtocol: 'tcp',
                fromPort: 22,
                toPort: 22,
                cidrIp: cdk.Fn.findInMap('SubnetConfig', 'PublicOne', 'CIDR'),
                description: 'Enable SSH access via port 22 from VPC'
            }]
        });

        CfnNagHelper.addSuppressions(kafkaClientSG, {
            Id: 'W9',
            Reason: 'Access is restricted to the public subnet where the Cloud9 environment is located'
        });

        new ec2.CfnSecurityGroupIngress(this, 'KafkaClientInstanceSecurityGroup8081', {
            groupId: kafkaClientSG.attrGroupId,
            sourceSecurityGroupId: kafkaClientSG.attrGroupId,
            description: 'Schema Registry access inside the security group',
            ipProtocol: 'tcp',
            fromPort: 8081,
            toPort: 8081
        });

        const instanceProfile = new iam.CfnInstanceProfile(this, 'EC2InstanceProfile', { roles: [roleName.valueAsString] });
        const userDataCommands = [
            '#!/bin/bash',
            'yum install git -y',

            'cd /home && mkdir labs-resources',
            `git clone ${userDataLocation.valueAsString} labs-resources && cd $_`,
            `chmod +x ${setupScript.valueAsString} && ${setupScript.valueAsString}`
        ];

        const kafkaClient = new ec2.CfnInstance(this, 'KafkaClientEC2Instance', {
            instanceType: 'm5.large',
            keyName: keyPair.valueAsString,
            subnetId: cdk.Fn.ref('PrivateSubnetMSKOne'),
            securityGroupIds: [kafkaClientSG.attrGroupId],
            imageId: latestAmiId.valueAsString,
            tags: [{ key: 'Name', value: 'KafkaClientInstance' }],
            iamInstanceProfile: instanceProfile.ref,
            userData: cdk.Fn.base64(userDataCommands.join('\n'))
        });

        // If the instance is created before the route table (to the NAT Gateway) is available,
        // any commands that reach the internet (e.g. yum) will fail.
        kafkaClient.addDependsOn(mskVpc.getResource('PrivateRoute'));

        //---------------------------------------------------------------------
        // Solution metrics
        new SolutionHelper(this, 'SolutionHelper', {
            solutionId: props.solutionId,
            pattern: MskClientStack.name
        });

        //---------------------------------------------------------------------
        // Outputs
        new cdk.CfnOutput(this, 'SSHKafkaClientEC2Instance', {
            value: `ssh -A ec2-user@${kafkaClient.attrPrivateDnsName}`,
            description: 'SSH command for the EC2 instance',
            exportName: `${cdk.Aws.STACK_NAME}-SSHKafkaClientEC2Instance`
        });

        new cdk.CfnOutput(this, 'KafkaClientEC2InstancePrivateDNS', {
            value: kafkaClient.attrPrivateDnsName,
            description: 'The private DNS for the EC2 instance'
        });

        new cdk.CfnOutput(this, 'KafkaClientEC2InstanceSecurityGroupId', {
            value: kafkaClientSG.attrGroupId,
            description: 'ID of the security group for the EC2 instance',
            exportName: `${cdk.Aws.STACK_NAME}-KafkaClientEC2InstanceSecurityGroupId`
        });

        new cdk.CfnOutput(this, 'SchemaRegistryUrl', {
            value: `http://${kafkaClient.attrPrivateDnsName}:8081`,
            description: 'Url for the Schema Registry',
            exportName: `${cdk.Aws.STACK_NAME}-SchemaRegistryUrl`
        });
    }
}
