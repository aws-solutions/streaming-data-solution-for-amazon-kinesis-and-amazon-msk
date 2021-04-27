######################################################################################################################
#  Copyright 2020-2021 Amazon.com, Inc. or its affiliates. All Rights Reserved.                                      #
#                                                                                                                    #
#  Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance    #
#  with the License. A copy of the License is located at                                                             #
#                                                                                                                    #
#      http://www.apache.org/licenses/LICENSE-2.0                                                                    #
#                                                                                                                    #
#  or in the 'license' file accompanying this file. This file is distributed on an 'AS IS' BASIS, WITHOUT WARRANTIES #
#  OR CONDITIONS OF ANY KIND, express or implied. See the License for the specific language governing permissions    #
#  and limitations under the License.                                                                                #
######################################################################################################################

import boto3, logging, os, json
from crhelper import CfnResource
from botocore import config

config = config.Config(**json.loads(os.environ['AWS_SDK_USER_AGENT']))
client_kafka = boto3.client('kafka', config=config)

helper = CfnResource(json_logging=True, log_level='INFO')

def _get_networking_config(cluster_arn):
    response = client_kafka.describe_cluster(ClusterArn=cluster_arn)
    return (
        response['ClusterInfo']['BrokerNodeGroupInfo']['ClientSubnets'],
        response['ClusterInfo']['BrokerNodeGroupInfo']['SecurityGroups']
    )

def _get_bootstrap_brokers(cluster_arn):
    response = client_kafka.get_bootstrap_brokers(ClusterArn=cluster_arn)
    if 'BootstrapBrokerStringTls' in response:
        return response['BootstrapBrokerStringTls']
    return response['BootstrapBrokerString']

@helper.create
@helper.update
def get_cluster_details(event, _):
    cluster_arn = event['ResourceProperties']['ClusterArn']

    (subnets, security_groups) = _get_networking_config(cluster_arn)
    bootstrap_servers = _get_bootstrap_brokers(cluster_arn)

    helper.Data.update(
        Subnets=subnets,
        SecurityGroups=security_groups,
        BootstrapServers=bootstrap_servers
    )

@helper.delete
def no_op(_, __):
    pass # No action is required when stack is deleted

def handler(event, context):
    helper(event, context)
