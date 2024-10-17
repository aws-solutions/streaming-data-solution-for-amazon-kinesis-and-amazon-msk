/** ************************************************************************************************
*   Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.                             *
*   SPDX-License-Identifier: Apache-2.0                                                            *
 ************************************************************************************************ */


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
            runtime: lambda.Runtime.PYTHON_3_12,
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
