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
import * as iam from '@aws-cdk/aws-iam';
import * as cwlogs from '@aws-cdk/aws-logs';
import * as lambda from '@aws-cdk/aws-lambda';
import * as apigw from '@aws-cdk/aws-apigateway';

import { ApiGatewayToLambda } from '@aws-solutions-constructs/aws-apigateway-lambda';
import crypto = require('crypto');

import { DataStream } from '../lib/kds-data-stream';
import { KinesisProducer } from '../lib/kpl-producer';
import { FlinkApplication } from '../lib/kda-flink-application';
import { SolutionHelper } from '../lib/solution-helper';
import { SolutionStackProps } from './solution-props';
import { ApplicationMonitoring } from '../lib/kda-monitoring';
import { ExecutionRole } from '../lib/lambda-role-cloudwatch';

export class KdsKdaApiGw extends cdk.Stack {
    private readonly BinaryOptions = ['true', 'false'];

    constructor(scope: cdk.Construct, id: string, props: SolutionStackProps) {
        super(scope, id, props);

        //---------------------------------------------------------------------
        // Kinesis Data Stream configuration

        const shardCount = new cdk.CfnParameter(this, 'ShardCount', {
            type: 'Number',
            default: 2,
            minValue: 1,
            maxValue: 200
        });

        const dataRetention = new cdk.CfnParameter(this, 'RetentionHours', {
            type: 'Number',
            default: 24,
            minValue: 24,
            maxValue: 168
        });

        const enhancedMonitoring = new cdk.CfnParameter(this, 'EnableEnhancedMonitoring', {
            type: 'String',
            default: 'false',
            allowedValues: this.BinaryOptions
        });

        const kds = new DataStream(this, 'Kds', {
            shardCount: shardCount.valueAsNumber,
            retentionPeriod: cdk.Duration.hours(dataRetention.valueAsNumber),
            enableEnhancedMonitoring: enhancedMonitoring.valueAsString
        });

        //---------------------------------------------------------------------
        // Kinesis Replay configuration

        const producerVpc = new cdk.CfnParameter(this, 'ProducerVpcId', {
            type: 'AWS::EC2::VPC::Id'
        });

        const producerSubnet = new cdk.CfnParameter(this, 'ProducerSubnetId', {
            type: 'AWS::EC2::Subnet::Id'
        });

        const producerAmiId = new cdk.CfnParameter(this, 'ProducerAmiId', {
            type: 'AWS::SSM::Parameter::Value<AWS::EC2::Image::Id>',
            default: '/aws/service/ami-amazon-linux-latest/amzn2-ami-hvm-x86_64-gp2'
        });

        const kpl = new KinesisProducer(this, 'Kpl', {
            stream: kds.Stream,
            vpcId: producerVpc.valueAsString,
            subnetId: producerSubnet.valueAsString,
            imageId: producerAmiId.valueAsString,
            codeBucketName: cdk.Fn.join('-', ['%%BUCKET_NAME%%', cdk.Aws.REGION]),
            codeFileKey: cdk.Fn.join('/', ['%%SOLUTION_NAME%%/%%VERSION%%', 'amazon-kinesis-replay.zip'])
        });

        // Fare prediction endpoint
        const [fareEndpointApi, apiKey] = this.createFarePredictionEndpoint();

        //---------------------------------------------------------------------
        // Kinesis Data Analytics configuration

        const logLevel = new cdk.CfnParameter(this, 'LogLevel', {
            type: 'String',
            default: 'INFO',
            allowedValues: FlinkApplication.AllowedLogLevels
        });

        const metricsLevel = new cdk.CfnParameter(this, 'MetricsLevel', {
            type: 'String',
            default: 'OPERATOR',
            allowedValues: FlinkApplication.AllowedMetricLevels
        });

        const snapshots = new cdk.CfnParameter(this, 'EnableSnapshots', {
            type: 'String',
            default: 'true',
            allowedValues: this.BinaryOptions
        });

        const autoScaling = new cdk.CfnParameter(this, 'EnableAutoScaling', {
            type: 'String',
            default: 'true',
            allowedValues: this.BinaryOptions
        });

        const subnets = new cdk.CfnParameter(this, 'ApplicationSubnetIds', {
            type: 'CommaDelimitedList'
        });

        const securityGroups = new cdk.CfnParameter(this, 'ApplicationSecurityGroupIds', {
            type: 'CommaDelimitedList'
        });

        const kda = new FlinkApplication(this, 'Kda', {
            environmentProperties: {
                propertyGroupId: 'FlinkApplicationProperties',
                propertyMap: {
                    'InputStreamName': kds.Stream.streamName,
                    'Region': cdk.Aws.REGION,
                    'RideApiEndpoint': fareEndpointApi.url,
                    'ApiKey': apiKey
                }
            },

            logsRetentionDays: cwlogs.RetentionDays.ONE_YEAR,
            logLevel: logLevel.valueAsString,
            metricsLevel: metricsLevel.valueAsString,

            enableSnapshots: snapshots.valueAsString,
            enableAutoScaling: autoScaling.valueAsString,

            codeBucketArn: `arn:${cdk.Aws.PARTITION}:s3:::%%BUCKET_NAME%%-${cdk.Aws.REGION}`,
            codeFileKey: cdk.Fn.join('/', ['%%SOLUTION_NAME%%/%%VERSION%%', 'kda-flink-ml.zip']),

            subnetIds: subnets.valueAsList,
            securityGroupIds: securityGroups.valueAsList
        });

        kds.Stream.grantRead(kda.ApplicationRole);
        kda.ApplicationRole.addToPrincipalPolicy(new iam.PolicyStatement({
            resources: [`arn:${cdk.Aws.PARTITION}:execute-api:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:${fareEndpointApi.restApiId}/*/GET/*`],
            actions: ['execute-api:Invoke']
        }));

        //---------------------------------------------------------------------
        // Solution metrics

        new SolutionHelper(this, 'SolutionHelper', {
            solutionId: props.solutionId,
            pattern: KdsKdaApiGw.name,

            shardCount: shardCount.valueAsNumber,
            retentionHours: dataRetention.valueAsNumber,
            enhancedMonitoring: enhancedMonitoring.valueAsString
        });

        //---------------------------------------------------------------------
        // Monitoring (dashboard and alarms) configuration

        new ApplicationMonitoring(this, 'Monitoring', {
            applicationName: kda.ApplicationName,
            logGroupName: kda.LogGroupName,
            inputStreamName: kds.Stream.streamName
        });

        //---------------------------------------------------------------------
        // Template metadata

        this.templateOptions.metadata = {
            'AWS::CloudFormation::Interface': {
                ParameterGroups: [
                    {
                        Label: { default: 'Amazon Kinesis Replay configuration' },
                        Parameters: [producerVpc.logicalId, producerSubnet.logicalId, producerAmiId.logicalId]
                    },
                    {
                        Label: { default: 'Amazon Kinesis Data Streams configuration' },
                        Parameters: [shardCount.logicalId, dataRetention.logicalId, enhancedMonitoring.logicalId]
                    },
                    {
                        Label: { default: 'Amazon Kinesis Data Analytics configuration' },
                        Parameters: [
                            logLevel.logicalId,
                            metricsLevel.logicalId,
                            snapshots.logicalId,
                            autoScaling.logicalId,
                            subnets.logicalId,
                            securityGroups.logicalId
                        ]
                    }
                ],
                ParameterLabels: {
                    [producerVpc.logicalId]: {
                        default: 'VPC where the KPL instance should be launched'
                    },
                    [producerSubnet.logicalId]: {
                        default: 'Subnet where the KPL instance should be launched (needs access to Kinesis - either via IGW or NAT)'
                    },
                    [producerAmiId.logicalId]: {
                        default: 'Amazon Machine Image for the KPL instance'
                    },

                    [shardCount.logicalId]: {
                        default: 'Number of open shards'
                    },
                    [dataRetention.logicalId]: {
                        default: 'Data retention period (hours)'
                    },
                    [enhancedMonitoring.logicalId]: {
                        default: 'Enable enhanced (shard-level) metrics'
                    },

                    [logLevel.logicalId]: {
                        default: 'Monitoring log level'
                    },
                    [metricsLevel.logicalId]: {
                        default: 'Monitoring metrics level'
                    },
                    [snapshots.logicalId]: {
                        default: 'Enable service-triggered snapshots'
                    },
                    [autoScaling.logicalId]: {
                        default: 'Enable automatic scaling'
                    },
                    [subnets.logicalId]: {
                        default: '(Optional) Comma-separated list of subnet ids for VPC connectivity (if informed, requires security groups to be included as well)'
                    },
                    [securityGroups.logicalId]: {
                        default: '(Optional) Comma-separated list of security groups ids for VPC connectivity (if informed, requires subnets to be included as well)'
                    }
                }
            }
        };

        //---------------------------------------------------------------------
        // Stack outputs

        new cdk.CfnOutput(this, 'ProducerInstance', {
            description: 'ID of the KPL Amazon EC2 instance',
            value: kpl.InstanceId
        });

        new cdk.CfnOutput(this, 'DataStreamName', {
            description: 'Name of the Amazon Kinesis Data stream',
            value: kds.Stream.streamName
        });

        new cdk.CfnOutput(this, 'ApplicationName', {
            description: 'Name of the Kinesis Data Analytics application',
            value: kda.ApplicationName
        });
    }

    private createFarePredictionEndpoint(): [apigw.RestApi, string] {
        const functionRole = new ExecutionRole(this, 'PredictFareRole');
        const predictFareLambda =  new lambda.Function(this, 'PredictFareLambda', {
            runtime: lambda.Runtime.NODEJS_12_X,
            code: lambda.Code.fromAsset('lambda/taxi-fare-endpoint'),
            handler: 'index.handler',
            role: functionRole.Role
        });

        const pattern = new ApiGatewayToLambda(this, 'RideApi', {
            apiGatewayProps: {
                apiKeySourceType: apigw.ApiKeySourceType.HEADER,
                restApiName: 'RideApi',
                proxy: false
            },
            existingLambdaObj: predictFareLambda
        });

        const predictFareModel = pattern.apiGateway.addModel('PredictFareModel', {
            schema: {
                type: apigw.JsonSchemaType.OBJECT,
                properties: {
                    rideRequestId: { type: apigw.JsonSchemaType.NUMBER, multipleOf: 1, minimum: 0 },
                },
                required: ['ride_request_id']
            }
        });

        const predictFareApi = pattern.apiGateway.root.addResource('predictFare');
        predictFareApi.addMethod('GET', new apigw.LambdaIntegration(predictFareLambda), {
            requestModels: { 'application/json': predictFareModel },
            authorizationType: apigw.AuthorizationType.IAM,
            apiKeyRequired: true,
            methodResponses: [{ statusCode: '200' }]
        });

        const apiKeyValue = crypto.createHash('sha256').update(cdk.Aws.ACCOUNT_ID).digest('hex');
        new apigw.UsagePlan(this, 'UsagePlan', {
            throttle: { rateLimit: 20, burstLimit: 100 },
            apiStages: [{
                api: predictFareApi.api,
                stage: predictFareApi.api.deploymentStage,
            }],
            apiKey: new apigw.ApiKey(this, 'ApiKey', { value: apiKeyValue })
        });

        return [pattern.apiGateway, apiKeyValue];
    }
}
