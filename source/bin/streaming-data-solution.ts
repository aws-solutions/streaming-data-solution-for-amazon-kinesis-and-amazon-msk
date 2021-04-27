#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { AwsSdkConfig } from './aws-sdk-aspect';
import { CfnNagAspect } from './cfn-nag-aspect';
import crypto = require('crypto');

import { ApiGwKdsLambda } from '../patterns/apigw-kds-lambda';
import { KplKdsKda } from '../patterns/kpl-kds-kda';
import { KdsKdfS3 } from '../patterns/kds-kdf-s3';
import { KdsKdaApiGw } from '../patterns/kds-kda-apigw';
import { MskStandalone } from '../patterns/msk-standalone-cluster';
import { MskLambda } from '../patterns/msk-lambda';
import { MskLambdaKdf } from '../patterns/msk-lambda-kdf';
import { MskKdaS3 } from '../patterns/msk-kda-s3';

import { MskLambdaRoleStack } from '../labs/msk-lambda-role';
import { MskClientStack } from '../labs/msk-client-setup';
import { MskClusterStack } from '../labs/msk-cluster-setup';

const app = new cdk.App();
const solutionIdKds = 'SO0124';
const solutionIdMsk = 'SO0151';
const solutionIdMskLabs = `${solutionIdMsk}labs`;

function applyAspects(stacks: cdk.Stack[], solutionId: string) {
    for (const stack of stacks) {
        const hash = crypto.createHash('sha256').update(stack.stackName).digest('hex');
        cdk.Aspects.of(stack).add(new AwsSdkConfig(app, `CustomUserAgent-${hash}`, solutionId));
        cdk.Aspects.of(stack).add(new CfnNagAspect(app, `CfnNag-${hash}`));
    }
}

function createSolutionKinesisStacks() {
    const stacks: cdk.Stack[] = [];

    stacks.push(new ApiGwKdsLambda(
        app,
        'aws-streaming-data-solution-for-kinesis-using-api-gateway-and-lambda',
        {
            description: `(${solutionIdKds}) - AWS Streaming Data Solution for Amazon Kinesis (APIGW -> KDS -> Lambda). Version %%VERSION%%`,
            solutionId: solutionIdKds
        }
    ));

    stacks.push(new KplKdsKda(
        app,
        'aws-streaming-data-solution-for-kinesis-using-kpl-and-kinesis-data-analytics',
        {
            description: `(${solutionIdKds}) - AWS Streaming Data Solution for Amazon Kinesis (KPL -> KDS -> KDA). Version %%VERSION%%`,
            solutionId: solutionIdKds
        }
    ));

    stacks.push(new KdsKdfS3(
        app,
        'aws-streaming-data-solution-for-kinesis-using-kinesis-data-firehose-and-amazon-s3',
        {
            description: `(${solutionIdKds}) - AWS Streaming Data Solution for Amazon Kinesis (KDS -> KDF -> S3). Version %%VERSION%%`,
            solutionId: solutionIdKds
        }
    ));

    stacks.push(new KdsKdaApiGw(
        app,
        'aws-streaming-data-solution-for-kinesis-using-kinesis-data-analytics-and-api-gateway',
        {
            description: `(${solutionIdKds}) - AWS Streaming Data Solution for Amazon Kinesis (KDS -> KDA -> APIGW). Version %%VERSION%%`,
            solutionId: solutionIdKds
        }
    ));

    applyAspects(stacks, solutionIdKds);
}

function createSolutionMskStacks() {
    const stacks: cdk.Stack[] = [];

    stacks.push(new MskStandalone(
        app,
        'aws-streaming-data-solution-for-msk',
        {
            description: `(${solutionIdMsk}) - AWS Streaming Data Solution for Amazon MSK. Version %%VERSION%%`,
            solutionId: solutionIdMsk
        }
    ));

    stacks.push(new MskLambda(
        app,
        'aws-streaming-data-solution-for-msk-using-aws-lambda',
        {
            description: `(${solutionIdMsk}) - AWS Streaming Data Solution for Amazon MSK (MSK -> Lambda). Version %%VERSION%%`,
            solutionId: solutionIdMsk
        }
    ));

    stacks.push(new MskLambdaKdf(
        app,
        'aws-streaming-data-solution-for-msk-using-aws-lambda-and-kinesis-data-firehose',
        {
            description: `(${solutionIdMsk}) - AWS Streaming Data Solution for Amazon MSK (MSK -> Lambda -> KDF). Version %%VERSION%%`,
            solutionId: solutionIdMsk
        }
    ));

    stacks.push(new MskKdaS3(
        app,
        'aws-streaming-data-solution-for-msk-using-kinesis-data-analytics-and-amazon-s3',
        {
            description: `(${solutionIdMsk}) - AWS Streaming Data Solution for Amazon MSK (MSK -> KDA -> S3). Version %%VERSION%%`,
            solutionId: solutionIdMsk
        }
    ));

    applyAspects(stacks, solutionIdMsk);
}

function createSolutionMskLabsStacks() {
    const stacks: cdk.Stack[] = [];

    stacks.push(new MskLambdaRoleStack(
        app,
        'amazon-msk-labs-lambda-role',
        {
            description: `(${solutionIdMskLabs}) - Amazon MSK Labs (IAM Role). Version %%VERSION%%`,
            solutionId: solutionIdMskLabs
        }
    ));

    stacks.push(new MskClientStack(
        app,
        'amazon-msk-labs-ec2-client',
        {
            description: `(${solutionIdMskLabs}) - Amazon MSK Labs (EC2 Client). Version %%VERSION%%`,
            solutionId: solutionIdMskLabs
        }
    ));

    stacks.push(new MskClusterStack(
        app,
        'amazon-msk-labs-cluster',
        {
            description: `(${solutionIdMskLabs}) - Amazon MSK Labs (MSK Cluster). Version %%VERSION%%`,
            solutionId: solutionIdMskLabs
        }
    ));

    applyAspects(stacks, solutionIdMskLabs);
}

createSolutionKinesisStacks();
createSolutionMskStacks();
createSolutionMskLabsStacks();
