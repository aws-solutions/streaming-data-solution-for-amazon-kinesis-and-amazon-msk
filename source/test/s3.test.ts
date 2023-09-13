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

import { Template, Match } from 'aws-cdk-lib/assertions';

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
    Transitions: [
        {
            StorageClass: 'INTELLIGENT_TIERING',
            TransitionInDays: 1
        }
    ]
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
        ServerSideEncryptionConfiguration: [
            {
                ServerSideEncryptionByDefault: {
                    SSEAlgorithm: 'AES256'
                }
            }
        ]
    };

    const expectedPublicConfig = {
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true
    };

    Template.fromStack(stack).hasResourceProperties('AWS::S3::Bucket', {
            BucketEncryption: expectedEncryption,
            PublicAccessBlockConfiguration: expectedPublicConfig
        });

        Template.fromStack(stack).hasResourceProperties('AWS::S3::Bucket', {
            LifecycleConfiguration: {
                Rules: [multipartUploadRule, intelligentTieringRule]
            },
            LoggingConfiguration: {},
            BucketEncryption: expectedEncryption,
            PublicAccessBlockConfiguration: expectedPublicConfig
        });

    Template.fromStack(stack).hasResourceProperties('AWS::S3::BucketPolicy', {
            PolicyDocument: {
                Statement: [
                    {
                        Effect: 'Deny',
                        Action: 's3:*',
                        Condition: {
                            Bool: { 'aws:SecureTransport': 'false' }
                        },
                        Principal: { 'AWS': '*' },
                        Resource: [
                            Match.anyValue(), Match.anyValue()
                          ],    
                    }
                ],
                Version: '2012-10-17'
            }
        });
    

        Template.fromStack(stack).hasResourceProperties('AWS::S3::BucketPolicy', {
            PolicyDocument: {
                Statement: [
                    {
                        Effect: 'Deny',
                        Action: 's3:*',
                        Condition: {
                            Bool: { 'aws:SecureTransport': 'false' }
                        },
                        Principal: { 'AWS': '*' },
                        Resource: [
                            Match.anyValue(), Match.anyValue()
                          ],    
                    },
                    {
                        Action: 's3:PutObject',
                        Sid: 'S3ServerAccessLogsPolicy',
                        Effect: 'Allow',
                        Condition: {
                            ArnLike: {
                                'aws:SourceArn': [
                                    {
                                        'Fn::GetAtt': ['TestBucket9EEBCF70', 'Arn']
                                    }
                                ]
                            },
                            StringEquals: {
                                'aws:SourceAccount': {
                                    'Ref': 'AWS::AccountId'
                                }
                            }
                        },
                        Principal: {
                            Service: 'logging.s3.amazonaws.com'
                        },
                        Resource: {
                            'Fn::Join': [
                                '',
                                [
                                    {
                                        'Fn::GetAtt': ['TestBucketAccessLogsBucket4922A84A', 'Arn']
                                    },
                                    '/*'
                                ]
                            ]
                        }
                    }
                ],
                Version: '2012-10-17'
            }
        })
        
    });

test('creates a bucket without intelligent tiering', () => {
    new EncryptedBucket(stack, 'TestBucket', {
        enableIntelligentTiering: false
    });

    Template.fromStack(stack).hasResourceProperties('AWS::S3::Bucket', Match.not({
            LifecycleConfiguration: {
                Rules: [intelligentTieringRule]
            }
        }))
});


test('adds cfn_nag suppressions', () => {
    new EncryptedBucket(stack, 'TestBucket', {
        enableIntelligentTiering: true
    });

    Template.fromStack(stack).hasResource(
            'AWS::S3::Bucket',
            {
                Metadata: {
                    cfn_nag: {
                        rules_to_suppress: [
                            {
                                id: 'W35',
                                reason: 'This bucket is used to store access logs for another bucket'
                            }
                        ]
                    }
                }
            });
});