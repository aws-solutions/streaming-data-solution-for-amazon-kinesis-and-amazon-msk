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
import { Construct } from 'constructs';
import { aws_iam as iam, aws_s3 as s3 } from 'aws-cdk-lib';

import { CfnNagHelper } from './cfn-nag-helper';
import { CfnGuardHelper } from './cfn-guard-helper';

export interface EncryptedBucketProps {
    readonly enableIntelligentTiering: boolean;
}

export class EncryptedBucket extends Construct {
    public readonly Bucket: s3.IBucket;

    constructor(scope: Construct, id: string, props: EncryptedBucketProps) {
        super(scope, id);

        const securitySettings: s3.BucketProps = {
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            encryption: s3.BucketEncryption.S3_MANAGED,
            enforceSSL: true
        };

        const accessLogsBucket = new s3.Bucket(this, 'AccessLogsBucket', securitySettings); // NOSONAR: log bucket

        const rules: s3.LifecycleRule[] = [
            {
                id: 'multipart-upload-rule',
                enabled: true,
                abortIncompleteMultipartUploadAfter: cdk.Duration.days(7)
            }
        ];

        if (props.enableIntelligentTiering) {
            rules.push({
                id: 'intelligent-tiering-rule',
                enabled: true,
                transitions: [
                    {
                        storageClass: s3.StorageClass.INTELLIGENT_TIERING,
                        transitionAfter: cdk.Duration.days(1)
                    }
                ]
            });
        }

        this.Bucket = new s3.Bucket(this, 'Bucket', { // NOSONAR: securitySettings provide needed security
            ...securitySettings,
            serverAccessLogsBucket: accessLogsBucket,
            lifecycleRules: rules
        });

        CfnGuardHelper.addSuppressions(this.Bucket.node.defaultChild as s3.CfnBucket, 'S3_BUCKET_NO_PUBLIC_RW_ACL');

        // remove ACL and add S3 bucket policy to write to access logging bucket
        (accessLogsBucket.node.defaultChild as s3.CfnBucket).addDeletionOverride('Properties.AccessControl');
        accessLogsBucket.addToResourcePolicy(
            new iam.PolicyStatement({
                sid: 'S3ServerAccessLogsPolicy',
                effect: iam.Effect.ALLOW,
                principals: [new iam.ServicePrincipal('logging.s3.amazonaws.com')],
                actions: ['s3:PutObject'],
                resources: [`${accessLogsBucket.bucketArn}/*`],
                conditions: {
                    ArnLike: {
                        'aws:SourceArn': [`${this.Bucket.bucketArn}`]
                    },
                    StringEquals: { 'aws:SourceAccount': cdk.Aws.ACCOUNT_ID }
                }
            })
        );

        CfnNagHelper.addSuppressions(accessLogsBucket.node.defaultChild as s3.CfnBucket, [
            { Id: 'W35', Reason: 'This bucket is used to store access logs for another bucket' }
        ]);

        CfnGuardHelper.addSuppressions(accessLogsBucket.node.defaultChild as s3.CfnBucket, 'S3_BUCKET_NO_PUBLIC_RW_ACL');
    }
}