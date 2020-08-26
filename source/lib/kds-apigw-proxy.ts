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
import * as apigw from '@aws-cdk/aws-apigateway';
import * as iam from '@aws-cdk/aws-iam';
import * as cwlogs from '@aws-cdk/aws-logs';
import * as kinesis from '@aws-cdk/aws-kinesis';

export interface ProxyApiProps {
    readonly stream: kinesis.IStream;
    readonly accessLogsRetention: cwlogs.RetentionDays;
    readonly throttlingRateLimit: number;
    readonly throttlingBurstLimit: number;
}

interface IntegrationProps {
    readonly action: string;
    readonly path: string;
    readonly requestTemplate: string;
    readonly role: iam.Role;
    readonly model: apigw.IModel;
    readonly validator: apigw.IRequestValidator;
}

export class ProxyApi extends cdk.Construct {
    public readonly Api: apigw.RestApi;

    constructor(scope: cdk.Construct, id: string, props: ProxyApiProps) {
        super(scope, id);

        if (!cdk.Token.isUnresolved(props.throttlingRateLimit) && props.throttlingRateLimit <= 0) {
            throw new Error('throttlingRateLimit must be a positive number');
        }

        if (!cdk.Token.isUnresolved(props.throttlingBurstLimit) && props.throttlingBurstLimit < 0) {
            throw new Error('throttlingBurstLimit must be a non-negative number');
        }

        const logGroup = new cwlogs.LogGroup(this, 'AccessLogs', {
            retention: props.accessLogsRetention,
            removalPolicy: cdk.RemovalPolicy.RETAIN
        });

        const apiGatewayRole = new iam.Role(this, 'ApiGatewayRole', {
            assumedBy: new iam.ServicePrincipal('apigateway.amazonaws.com')
        });

        props.stream.grantWrite(apiGatewayRole);

        this.Api = new apigw.RestApi(this, 'Api', {
            restApiName: `${cdk.Aws.STACK_NAME}-kinesis-proxy`,
            cloudWatchRole: true,
            deployOptions: {
                methodOptions: {
                    '/*/*': {
                        throttlingRateLimit: props.throttlingRateLimit,
                        throttlingBurstLimit: props.throttlingBurstLimit
                    }
                },
                accessLogDestination: new apigw.LogGroupLogDestination(logGroup),
                accessLogFormat: apigw.AccessLogFormat.clf()
            }
        });

        const validator = this.Api.addRequestValidator('Validator', {
            requestValidatorName: 'default-validator',
            validateRequestBody: true
        });

        this.addIntegration({
            action: 'PutRecord',
            path: 'record',
            model: this.getPutRecordModel(),
            requestTemplate: this.getPutRecordRequestTemplate(props.stream.streamName),
            role: apiGatewayRole,
            validator
        });

        this.addIntegration({
            action: 'PutRecords',
            path: 'records',
            model: this.getPutRecordsModel(),
            requestTemplate: this.getPutRecordsRequestTemplate(props.stream.streamName),
            role: apiGatewayRole,
            validator
        });

        this.addCfnNagSuppressions();
    }

    private getPutRecordRequestTemplate(streamName: string): string {
        return `{ "StreamName": "${streamName}", "Data": "$util.base64Encode($input.json('$.data'))", "PartitionKey": "$input.path('$.partitionKey')" }`;
    }

    private getPutRecordModel(): apigw.IModel {
        return this.Api.addModel('PutRecordModel', {
            contentType: 'application/json',
            modelName: 'PutRecordModel',
            description: 'PutRecord proxy single-record payload',
            schema: {
                schema: apigw.JsonSchemaVersion.DRAFT4,
                title: 'PutRecord proxy single-record payload',
                type: apigw.JsonSchemaType.OBJECT,
                required: ['data', 'partitionKey'],
                properties: {
                    data: { type: apigw.JsonSchemaType.STRING },
                    partitionKey: { type: apigw.JsonSchemaType.STRING }
                }
            }
        });
    }

    private getPutRecordsRequestTemplate(streamName: string): string {
        return `{ "StreamName": "${streamName}", "Records": [ #foreach($elem in $input.path('$.records')) { "Data": "$util.base64Encode($elem.data)", "PartitionKey": "$elem.partitionKey"}#if($foreach.hasNext),#end #end ] }`;
    }

    private getPutRecordsModel(): apigw.IModel {
        return this.Api.addModel('PutRecordsModel', {
            contentType: 'application/json',
            modelName: 'PutRecordsModel',
            description: 'PutRecords proxy payload data',
            schema: {
                schema: apigw.JsonSchemaVersion.DRAFT4,
                title: 'PutRecords proxy payload data',
                type: apigw.JsonSchemaType.OBJECT,
                required: ['records'],
                properties: {
                    records: {
                        type: apigw.JsonSchemaType.ARRAY,
                        items: {
                            type: apigw.JsonSchemaType.OBJECT,
                            required: ['data', 'partitionKey'],
                            properties: {
                                data: { type: apigw.JsonSchemaType.STRING },
                                partitionKey: { type: apigw.JsonSchemaType.STRING }
                            }
                        }
                    }
                }
            }
        });
    }

    private addIntegration(props: IntegrationProps)  {
        const integration = new apigw.AwsIntegration({
            service: 'kinesis',
            integrationHttpMethod: 'POST',
            action: props.action,
            options: {
                credentialsRole: props.role,
                passthroughBehavior: apigw.PassthroughBehavior.NEVER,
                requestParameters: {
                    'integration.request.header.Content-Type': "'x-amz-json-1.1'"
                },
                requestTemplates: {
                    'application/json': props.requestTemplate
                },
                integrationResponses: [
                    {
                        statusCode: '200'
                    },
                    {
                        statusCode: '500',
                        selectionPattern: '5\\d{2}'
                    }
                ]
            }
        });

        const resource = this.Api.root.addResource(props.path, {
            defaultCorsPreflightOptions: {
                allowOrigins: apigw.Cors.ALL_ORIGINS,
                allowMethods: ['PUT']
            }
        });

        resource.addMethod('PUT', integration, {
            authorizationType: apigw.AuthorizationType.IAM,
            requestModels: {
                'application/json': props.model
            },
            requestValidator: props.validator,
            methodResponses: [
                {
                    statusCode: '200',
                    responseParameters: { 'method.response.header.Content-Type': true }
                },
                {
                    statusCode: '500',
                    responseParameters: { 'method.response.header.Content-Type': true }
                }
            ]
        });
    }

    private addCfnNagSuppressions() {
        const cfnDeployment = this.Api.latestDeployment?.node.defaultChild as apigw.CfnDeployment;
        cfnDeployment.cfnOptions.metadata = {
            cfn_nag: {
                rules_to_suppress: [{
                    id: 'W68',
                    reason: 'Default usage plan can be used for this API'
                }]
            }
        };

        const cfnStage = this.Api.deploymentStage.node.defaultChild as apigw.CfnStage;
        cfnStage.cfnOptions.metadata = {
            cfn_nag: {
                rules_to_suppress: [{
                    id: 'W64',
                    reason: 'Default usage plan can be used for this API'
                }]
            }
        };
    }
}
