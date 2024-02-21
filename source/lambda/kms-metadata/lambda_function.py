######################################################################################################################
#  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.                                                #
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
client_secrets_manager = boto3.client('secretsmanager', config=config)

helper = CfnResource(json_logging=True, log_level='INFO')

def _get_key_arn_for_kms(kms_key_id):
    '''
        This custom resource checks for the existence of a KMS key, and returns the KMS key ARN.
    '''
    client_kms = boto3.client('kms', config=config)
    response = client_kms.describe_key(KeyId=kms_key_id)

    if 'KeyMetadata' not in response:
        raise KeyError('The KMS key does not exist')

    return response['KeyMetadata']['Arn']

@helper.create
@helper.update
def _get_key_arn(event, _):
    kms_key_id = event['ResourceProperties']['KmsKeyId']
    helper.Data.update(KmsKeyArn=_get_key_arn_for_kms(kms_key_id))

@helper.delete
def no_op(_, __):
    pass # No action is required when stack is deleted

def handler(event, context):
    helper(event, context)
