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
import * as s3 from '@aws-cdk/aws-s3';
import * as iam from '@aws-cdk/aws-iam';

import { CfnNagHelper } from './cfn-nag-helper';

export interface EncryptedBucketProps {
    readonly enableIntelligentTiering: boolean;
}

export class EncryptedBucket extends cdk.Construct {
    public readonly Bucket: s3.IBucket;

    constructor(scope: cdk.Construct, id: string, props: EncryptedBucketProps) {
        super(scope, id);

        const securitySettings: s3.BucketProps = {
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            encryption: s3.BucketEncryption.S3_MANAGED
        }

        const accessLogsBucket = new s3.Bucket(this, 'AccessLogsBucket', securitySettings);
        CfnNagHelper.addSuppressions(accessLogsBucket.node.defaultChild as s3.CfnBucket, [
            { Id: 'W35', Reason: 'This bucket is used to store access logs for another bucket' },
            { Id: 'W51', Reason: 'This bucket does not need a bucket policy' }
        ]);

        const rules: s3.LifecycleRule[] = [{
            id: 'multipart-upload-rule',
            enabled: true,
            abortIncompleteMultipartUploadAfter: cdk.Duration.days(7)
        }];

        if (props.enableIntelligentTiering) {
            rules.push({
                id: 'intelligent-tiering-rule',
                enabled: true,
                transitions: [{
                    storageClass: s3.StorageClass.INTELLIGENT_TIERING,
                    transitionAfter: cdk.Duration.days(1)
                }]
            });
        }

       this.Bucket = new s3.Bucket(this, 'Bucket', {
            ...securitySettings,
            serverAccessLogsBucket: accessLogsBucket,
            lifecycleRules: rules
        });

        this.Bucket.addToResourcePolicy(new iam.PolicyStatement({
            sid: 'HttpsOnly',
            effect: iam.Effect.DENY,
            resources: [
                this.Bucket.arnForObjects('*'),
                this.Bucket.bucketArn
            ],
            actions: ['*'],
            principals: [new iam.AnyPrincipal()],
            conditions: {
                Bool: { 'aws:SecureTransport': 'false' }
            }
        }));
    }
}
