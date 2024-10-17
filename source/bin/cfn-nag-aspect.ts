/** ************************************************************************************************
*   Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.                             *
*   SPDX-License-Identifier: Apache-2.0                                                            *
 ************************************************************************************************ */

import * as cdk  from 'aws-cdk-lib';
import { Construct, IConstruct } from 'constructs';
import { aws_ec2 as ec2, aws_lambda as lambda, aws_logs as logs } from 'aws-cdk-lib';

import { CfnNagHelper } from '../lib/cfn-nag-helper';

export class CfnNagAspect extends Construct implements cdk.IAspect {
    public visit(node: IConstruct): void {
        if (node instanceof lambda.Function) {
            const cfnFunction = node.node.defaultChild as lambda.CfnFunction;
            CfnNagHelper.addSuppressions(cfnFunction, [
                {
                    Id: 'W89',
                    Reason: 'This function does not need to be deployed in a VPC'
                },
                {
                    Id: 'W92',
                    Reason: 'This function does not require reserved concurrency'
                }
            ]);
        } else if (node instanceof ec2.CfnSecurityGroup) {
            CfnNagHelper.addSuppressions(node, {
                Id: 'F1000',
                Reason: 'No egress rule defined as default (all traffic allowed outbound) is sufficient for this resource'
            });
        } else if (node instanceof logs.LogGroup) {
            const cfnLogGroup = node.node.defaultChild as logs.CfnLogGroup;
            CfnNagHelper.addSuppressions(cfnLogGroup, {
                Id: 'W84',
                Reason: 'Log group data is always encrypted in CloudWatch Logs using an AWS Managed KMS Key'
            });
        }
    }
}
