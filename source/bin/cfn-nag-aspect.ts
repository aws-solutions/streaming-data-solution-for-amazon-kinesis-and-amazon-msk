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

import * as cdk from '@aws-cdk/core';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as lambda from '@aws-cdk/aws-lambda';
import * as logs from '@aws-cdk/aws-logs';

import { CfnNagHelper } from '../lib/cfn-nag-helper';

export class CfnNagAspect extends cdk.Construct implements cdk.IAspect {
    public visit(node: cdk.IConstruct): void {
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
