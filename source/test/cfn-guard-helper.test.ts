/** ************************************************************************************************
*   Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.                             *
*   SPDX-License-Identifier: Apache-2.0                                                            *
 ************************************************************************************************ */

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
