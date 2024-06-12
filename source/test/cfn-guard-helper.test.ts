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

import { CfnGuardHelper } from '../lib/cfn-guard-helper';

let stack: cdk.Stack;

beforeEach(() => {
    const app = new cdk.App();
    stack = new cdk.Stack(app, 'TestStack');
});

test('removes duplicate suppressions', () => {
    const cfnBucket = new s3.CfnBucket(stack, 'TestBucket');

    // Add individual suppression
    CfnGuardHelper.addSuppressions(cfnBucket, 'S3_BUCKET_NO_PUBLIC_RW_ACL');

    // Add multiple suppressions (one of which is an overwrite)
    CfnGuardHelper.addSuppressions(cfnBucket, ['S3_BUCKET_NO_PUBLIC_RW_ACL', 'S3_BUCKET_ANOTHER_SUPPRESSED_RULE']);

    Template.fromStack(stack).hasResource('AWS::S3::Bucket', {
        Metadata: {
            guard: {
                SuppressedRules: ['S3_BUCKET_NO_PUBLIC_RW_ACL', 'S3_BUCKET_ANOTHER_SUPPRESSED_RULE']
            }
        }
    })});
