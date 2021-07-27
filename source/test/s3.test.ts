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
import { expect as expectCDK, haveResource, haveResourceLike, ResourcePart } from '@aws-cdk/assert';

import { EncryptedBucket } from '../lib/s3-bucket';

let stack: cdk.Stack;

const multipartUploadRule = {
    Status: 'Enabled',
    AbortIncompleteMultipartUpload: {
        DaysAfterInitiation: 7
    }
};

const intelligentTieringRule = {
    Status: 'Enabled',
    Transitions: [{
        StorageClass: 'INTELLIGENT_TIERING',
        TransitionInDays: 1
    }]
};

beforeEach(() => {
    const app = new cdk.App();
    stack = new cdk.Stack(app, 'TestStack');
});

test('creates a bucket with intelligent tiering', () => {
    new EncryptedBucket(stack, 'TestBucket', {
        enableIntelligentTiering: true
    });

    const expectedEncryption = {
        ServerSideEncryptionConfiguration: [{
            ServerSideEncryptionByDefault: {
                SSEAlgorithm: 'AES256'
            }
        }]
    };

    const expectedPublicConfig = {
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true
    };

    expectCDK(stack).to(haveResource('AWS::S3::Bucket', {
        AccessControl: 'LogDeliveryWrite',
        BucketEncryption: expectedEncryption,
        PublicAccessBlockConfiguration: expectedPublicConfig
    }));

    expectCDK(stack).to(haveResourceLike('AWS::S3::Bucket', {
        LifecycleConfiguration: {
            Rules: [multipartUploadRule, intelligentTieringRule]
        },
        LoggingConfiguration: {},
        BucketEncryption: expectedEncryption,
        PublicAccessBlockConfiguration: expectedPublicConfig
    }));

    expectCDK(stack).to(haveResource('AWS::S3::BucketPolicy', {
        PolicyDocument: {
            Statement: [{
                Sid: 'HttpsOnly',
                Effect: 'Deny',
                Action: '*',
                Principal: '*',
                Condition: {
                    Bool: { 'aws:SecureTransport': 'false' }
                },
                Resource: [
                    {
                        'Fn::Join': [
                            '',
                            [{ 'Fn::GetAtt': ['TestBucket9EEBCF70', 'Arn'] }, '/*']
                        ]
                    },
                    {
                        'Fn::GetAtt': ['TestBucket9EEBCF70', 'Arn']
                    }
                ]
            }],
            Version: '2012-10-17'
        }
    }));
});

test('creates a bucket without intelligent tiering', () => {
    new EncryptedBucket(stack, 'TestBucket', {
        enableIntelligentTiering: false
    });

    expectCDK(stack).notTo(haveResourceLike('AWS::S3::Bucket', {
        LifecycleConfiguration: {
            Rules: [intelligentTieringRule]
        }
    }));
});

test('adds cfn_nag suppressions', () => {
    new EncryptedBucket(stack, 'TestBucket', {
        enableIntelligentTiering: true
    });

    expectCDK(stack).to(haveResource('AWS::S3::Bucket', {
        Metadata: {
            cfn_nag: {
                rules_to_suppress: [
                    {
                        id: 'W35',
                        reason: 'This bucket is used to store access logs for another bucket'
                    },
                    {
                        id: 'W51',
                        reason: 'This bucket does not need a bucket policy'
                    }
                ]
            }
        }
    }, ResourcePart.CompleteDefinition));
});
