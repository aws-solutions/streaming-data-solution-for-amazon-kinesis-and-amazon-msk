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

import boto3
from crhelper import CfnResource

client_kinesis = boto3.client('kinesis')
helper = CfnResource(json_logging=True)

def _enhance_monitoring(stream_name, enable):
    shard_level_metrics = ['ALL']

    if enable == 'true':
        response = client_kinesis.enable_enhanced_monitoring(
            StreamName=stream_name,
            ShardLevelMetrics=shard_level_metrics
        )
    else:
        response = client_kinesis.disable_enhanced_monitoring(
            StreamName=stream_name,
            ShardLevelMetrics=shard_level_metrics
        )

    return response['DesiredShardLevelMetrics']

@helper.create
@helper.update
def manage_enhanced_monitoring(event, _):
    _enhance_monitoring(
        event['ResourceProperties']['StreamName'],
        event['ResourceProperties']['EnableEnhancedMonitoring']
    )

@helper.delete
def no_op(_, __):
    pass # No action is required when stack is deleted

def handler(event, context):
    helper(event, context)
