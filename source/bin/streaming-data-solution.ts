#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';

import { ApiGwKdsLambda } from '../patterns/apigw-kds-lambda';
import { KplKdsKda } from '../patterns/kpl-kds-kda';
import { KdsKdfS3 } from '../patterns/kds-kdf-s3';
import { KdsKdaApiGw } from '../patterns/kds-kda-apigw';
import { MskStandalone } from '../patterns/msk-standalone-cluster';
import { MskLambda } from '../patterns/msk-lambda';
import { MskLambdaKdf } from '../patterns/msk-lambda-kdf';
import { MskKdaS3 } from '../patterns/msk-kda-s3';

const app = new cdk.App();
const solutionIdKds = 'SO0124';
const solutionIdMsk = 'SO0151';

new ApiGwKdsLambda(
    app,
    'aws-streaming-data-solution-for-kinesis-using-api-gateway-and-lambda',
    {
        description: `(${solutionIdKds}) - AWS Streaming Data Solution for Amazon Kinesis (APIGW -> KDS -> Lambda). Version %%VERSION%%`,
        solutionId: solutionIdKds
    }
);

new KplKdsKda(
    app,
    'aws-streaming-data-solution-for-kinesis-using-kpl-and-kinesis-data-analytics',
    {
        description: `(${solutionIdKds}) - AWS Streaming Data Solution for Amazon Kinesis (KPL -> KDS -> KDA). Version %%VERSION%%`,
        solutionId: solutionIdKds
    }
);

new KdsKdfS3(
    app,
    'aws-streaming-data-solution-for-kinesis-using-kinesis-data-firehose-and-amazon-s3',
    {
        description: `(${solutionIdKds}) - AWS Streaming Data Solution for Amazon Kinesis (KDS -> KDF -> S3). Version %%VERSION%%`,
        solutionId: solutionIdKds
    }
);

new KdsKdaApiGw(
    app,
    'aws-streaming-data-solution-for-kinesis-using-kinesis-data-analytics-and-api-gateway',
    {
        description: `(${solutionIdKds}) - AWS Streaming Data Solution for Amazon Kinesis (KDS -> KDA -> APIGW). Version %%VERSION%%`,
        solutionId: solutionIdKds
    }
);

new MskStandalone(
    app,
    'aws-streaming-data-solution-for-msk',
    {
        description: `(${solutionIdMsk}) - AWS Streaming Data Solution for Amazon MSK. Version %%VERSION%%`,
        solutionId: solutionIdMsk
    }
);

new MskLambda(
    app,
    'aws-streaming-data-solution-for-msk-using-aws-lambda',
    {
        description: `(${solutionIdMsk}) - AWS Streaming Data Solution for Amazon MSK (MSK -> Lambda). Version %%VERSION%%`,
        solutionId: solutionIdMsk
    }
);

new MskLambdaKdf(
    app,
    'aws-streaming-data-solution-for-msk-using-aws-lambda-and-kinesis-data-firehose',
    {
        description: `(${solutionIdMsk}) - AWS Streaming Data Solution for Amazon MSK (MSK -> Lambda -> KDF). Version %%VERSION%%`,
        solutionId: solutionIdMsk
    }
);

new MskKdaS3(
    app,
    'aws-streaming-data-solution-for-msk-using-kinesis-data-analytics-and-amazon-s3',
    {
        description: `(${solutionIdMsk}) - AWS Streaming Data Solution for Amazon MSK (MSK -> KDA -> S3). Version %%VERSION%%`,
        solutionId: solutionIdMsk
    }
);
