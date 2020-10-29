#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';

import { ApiGwKdsLambda } from '../patterns/apigw-kds-lambda';
import { KplKdsKda } from '../patterns/kpl-kds-kda';
import { KdsKdfS3 } from '../patterns/kds-kdf-s3';
import { KdsKdaApiGw } from '../patterns/kds-kda-apigw';

const app = new cdk.App();
const solutionId = 'SO0124';

new ApiGwKdsLambda(
    app,
    'aws-streaming-data-solution-for-kinesis-using-api-gateway-and-lambda',
    {
        description: `(${solutionId}) - AWS Streaming Data Solution for Amazon Kinesis (APIGW -> KDS -> Lambda). Version %%VERSION%%`,
        solutionId
    }
);

new KplKdsKda(
    app,
    'aws-streaming-data-solution-for-kinesis-using-kpl-and-kinesis-data-analytics',
    {
        description: `(${solutionId}) - AWS Streaming Data Solution for Amazon Kinesis (KPL -> KDS -> KDA). Version %%VERSION%%`,
        solutionId
    }
);

new KdsKdfS3(
    app,
    'aws-streaming-data-solution-for-kinesis-using-kinesis-data-firehose-and-amazon-s3',
    {
        description: `(${solutionId}) - AWS Streaming Data Solution for Amazon Kinesis (KDS -> KDF -> S3). Version %%VERSION%%`,
        solutionId
    }
);

new KdsKdaApiGw(
    app,
    'aws-streaming-data-solution-for-kinesis-using-kinesis-data-analytics-and-api-gateway',
    {
        description: `(${solutionId}) - AWS Streaming Data Solution for Amazon Kinesis (KDS -> KDA -> APIGW). Version %%VERSION%%`,
        solutionId
    }
);
