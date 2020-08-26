/*********************************************************************************************************************
 *  Copyright 2020 Amazon.com, Inc. or its affiliates. All Rights Reserved.                                           *
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
        this.addCfnNagSuppressions(accessLogsBucket, true);

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

        this.addCfnNagSuppressions(this.Bucket);
    }

    private addCfnNagSuppressions(bucket: s3.IBucket, includeW35?: boolean) {
        const rules = [{
            id: 'W51',
            reason: 'This bucket does not need a bucket policy'
        }];

        if (includeW35) {
            rules.push({
                id: 'W35',
                reason: 'This bucket is used to store access logs for another bucket'
            });
        }

        const cfnBucket = bucket.node.defaultChild as s3.CfnBucket;
        cfnBucket.cfnOptions.metadata = {
            cfn_nag: {
                rules_to_suppress: rules
            }
        };
    }
}
