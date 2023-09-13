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

import * as cdk  from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { aws_lambda as lambda, aws_iam as iam } from 'aws-cdk-lib';

import { ExecutionRole } from './lambda-role-cloudwatch';
import { CfnNagHelper } from './cfn-nag-helper';

export interface KafkaMetadataProps {
    readonly clusterArn: string;
}

export class KafkaMetadata extends Construct {
    private readonly CustomResource: cdk.CustomResource;

    public get Subnets(): cdk.Reference {
        return this.CustomResource.getAtt('Subnets');
    }

    public get SecurityGroups(): cdk.Reference {
        return this.CustomResource.getAtt('SecurityGroups');
    }

    public get BootstrapServers(): cdk.Reference {
        return this.CustomResource.getAtt('BootstrapServers');
    }

    constructor(scope: Construct, id: string, props: KafkaMetadataProps) {
        super(scope, id);

        const metadataRole = new ExecutionRole(this, 'Role', {
            inlinePolicyName: 'MetadataPolicy',
            inlinePolicyDocument: new iam.PolicyDocument({
                statements: [
                    new iam.PolicyStatement({
                        actions: ['kafka:DescribeCluster', 'kafka:GetBootstrapBrokers'],
                        resources: ['*']
                    })
                ]
            })
        });

        const cfnRole = metadataRole.Role.node.defaultChild as iam.CfnRole;
        CfnNagHelper.addSuppressions(cfnRole, {
            Id: 'W11',
            Reason: 'MSK actions do not support resource level permissions'
        });

        const metadataFunction = new lambda.Function(this, 'CustomResource', {
            runtime: lambda.Runtime.PYTHON_3_10,
            handler: 'lambda_function.handler',
            description: 'This function retrieves metadata (such as list of brokers and networking) from a MSK cluster',
            role: metadataRole.Role,
            code: lambda.Code.fromAsset('lambda/msk-metadata'),
            timeout: cdk.Duration.minutes(1)
        });

        this.CustomResource = new cdk.CustomResource(this, 'MetadataHelper', {
            serviceToken: metadataFunction.functionArn,
            properties: {
                'ClusterArn': props.clusterArn
            },
            resourceType: 'Custom::MskMetadata'
        });
    }
}
