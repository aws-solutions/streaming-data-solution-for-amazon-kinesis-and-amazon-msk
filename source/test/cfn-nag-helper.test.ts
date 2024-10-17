/** ************************************************************************************************
*   Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.                             *
*   SPDX-License-Identifier: Apache-2.0                                                            *
 ************************************************************************************************ */

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
