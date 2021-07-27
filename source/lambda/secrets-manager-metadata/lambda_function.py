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

def _get_key_arn_for_secret(secret_arn):
    '''
        There are some requirements when using SCRAM authentication with Amazon MSK:
        https://docs.aws.amazon.com/msk/latest/developerguide/msk-password.html#msk-password-limitations

        This custom resource checks for those limitations, and returns the KmsKeyId
        (which will be used on the Lambda role policy).
    '''

    describe_response = client_secrets_manager.describe_secret(SecretId=secret_arn)
    if not describe_response['Name'].startswith('AmazonMSK_'):
        raise Exception('The name of secrets associated with an Amazon MSK cluster must have the prefix AmazonMSK_')

    if not 'KmsKeyId' in describe_response:
        raise Exception('You cannot use a Secret that uses the default Secrets Manager encryption key with Amazon MSK')

    return describe_response['KmsKeyId']

@helper.create
@helper.update
def get_secret_details(event, _):
    secret_arn = event['ResourceProperties']['SecretArn']
    kms_key_id = _get_key_arn_for_secret(secret_arn)
    helper.Data.update(KmsKeyId=kms_key_id)

@helper.delete
def no_op(_, __):
    pass # No action is required when stack is deleted

def handler(event, context):
    helper(event, context)
