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
import { aws_s3 as s3 } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';

import { CfnNagHelper } from '../lib/cfn-nag-helper';

let stack: cdk.Stack;

beforeEach(() => {
    const app = new cdk.App();
    stack = new cdk.Stack(app, 'TestStack');
});

test('removes duplicate suppressions', () => {
    const cfnBucket = new s3.CfnBucket(stack, 'TestBucket');

    // Add individual suppression
    CfnNagHelper.addSuppressions(cfnBucket, {
        Id: 'W1',
        Reason: 'This should be ignored'
    });

    // Add multiple suppressions (one of which is an overwrite)
    CfnNagHelper.addSuppressions(cfnBucket, [
        {
            Id: 'W1',
            Reason: 'Reason for warning 1'
        },
        {
            Id: 'W2',
            Reason: 'Reason for warning 2'
        },
        {
            Id: 'W3',
            Reason: 'Reason for warning 3'
        }
    ]);

    Template.fromStack(stack).hasResource('AWS::S3::Bucket', {
        Metadata: {
            cfn_nag: {
                rules_to_suppress: [
                    {
                        id: 'W1',
                        reason: 'Reason for warning 1'
                    },
                    {
                        id: 'W2',
                        reason: 'Reason for warning 2'
                    },
                    {
                        id: 'W3',
                        reason: 'Reason for warning 3'
                    }
                ]
            }
        }
    })});
