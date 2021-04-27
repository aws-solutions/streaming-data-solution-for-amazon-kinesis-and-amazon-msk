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
client_iam = boto3.client('iam', config=config)

helper = CfnResource(json_logging=True, log_level='INFO')
logger = logging.getLogger(__name__)

def _create_iam_resources():
    '''
    This function creates the IAM resources required for a no-ingress EC2 environment.
    https://docs.aws.amazon.com/cloud9/latest/user-guide/ec2-ssm.html#aws-cli-instance-profiles
    '''

    CLOUD9_ROLE = 'AWSCloud9SSMAccessRole'
    CLOUD9_INSTANCE_PROFILE = 'AWSCloud9SSMInstanceProfile'

    created_role = False
    created_instance_profile = False

    try:
        client_iam.get_role(RoleName=CLOUD9_ROLE)
        logger.info(f'{CLOUD9_ROLE} already exists, will not attempt to create it')
    except client_iam.exceptions.from_code('NoSuchEntityException'):
        client_iam.create_role(
            Path='/service-role/',
            RoleName=CLOUD9_ROLE,
            AssumeRolePolicyDocument='''{
                "Version": "2012-10-17",
                "Statement": [{
                    "Effect": "Allow",
                    "Principal": { "Service": ["ec2.amazonaws.com", "cloud9.amazonaws.com"] },
                    "Action": "sts:AssumeRole"
                }]
            }''',
            Description='Service linked role for AWS Cloud9'
        )
        logger.info(f'Created {CLOUD9_ROLE}')

        # Using a managed instance as this is the recommendation from the docs (https://docs.aws.amazon.com/cloud9/latest/user-guide/ec2-ssm.html#aws-cli-instance-profiles).
        # In addition to that, this policy only has the permissions required by SSM.
        client_iam.attach_role_policy(
            RoleName=CLOUD9_ROLE,
            PolicyArn='arn:aws:iam::aws:policy/AWSCloud9SSMInstanceProfile'
        )
        logger.info(f'Attached SSM policy to {CLOUD9_ROLE}')

        created_role = True

    try:
        client_iam.get_instance_profile(InstanceProfileName=CLOUD9_INSTANCE_PROFILE)
        logger.info(f'{CLOUD9_INSTANCE_PROFILE} already exists, will not attempt to create it')
    except client_iam.exceptions.from_code('NoSuchEntityException'):
        client_iam.create_instance_profile(
            InstanceProfileName=CLOUD9_INSTANCE_PROFILE,
            Path='/cloud9/'
        )
        logger.info(f'Created {CLOUD9_INSTANCE_PROFILE}')

        client_iam.add_role_to_instance_profile(
            InstanceProfileName=CLOUD9_INSTANCE_PROFILE,
            RoleName=CLOUD9_ROLE
        )
        logger.info(f'Added {CLOUD9_ROLE} to {CLOUD9_INSTANCE_PROFILE}')

        created_instance_profile = True

    return (created_role, created_instance_profile)

@helper.create
def setup_cloud9_requirements(_, __):
    _create_iam_resources()

@helper.update
@helper.delete
def no_op(_, __):
    pass # No action is required when stack is updated / deleted

def handler(event, context):
    helper(event, context)
