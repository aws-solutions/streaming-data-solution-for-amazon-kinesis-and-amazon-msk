######################################################################################################################
#  Copyright 2020 Amazon.com, Inc. or its affiliates. All Rights Reserved.                                           #
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

import boto3, logging
from crhelper import CfnResource

client = boto3.client('kinesisanalyticsv2')
helper = CfnResource(json_logging=True)
logger = logging.getLogger(__name__)

def _filter_empty_items(str_list):
    return list(filter(None, str_list))

def _get_application_details(application_name):
    response = client.describe_application(ApplicationName=application_name)
    application_detail = response['ApplicationDetail']
    description = application_detail['ApplicationConfigurationDescription']

    if 'VpcConfigurationDescriptions' in description:
        existing = description['VpcConfigurationDescriptions']
        vpc_config_id = existing[0]['VpcConfigurationId']
    else:
        vpc_config_id = None

    return (application_detail['ApplicationVersionId'], vpc_config_id)

def _add_config(application_name, version_id, subnets, securityGroups):
    response = client.add_application_vpc_configuration(
        ApplicationName=application_name,
        CurrentApplicationVersionId=version_id,
        VpcConfiguration={
            'SubnetIds': subnets,
            'SecurityGroupIds': securityGroups
        }
    )

    return response['VpcConfigurationDescription']['VpcConfigurationId']

def _remove_config(application_name, version_id, vpc_config_id):
    response = client.delete_application_vpc_configuration(
        ApplicationName=application_name,
        CurrentApplicationVersionId=version_id,
        VpcConfigurationId=vpc_config_id
    )

    return response['ApplicationVersionId']

def _add_vpc_configuration(application_name, subnet_ids, security_group_ids):
    (version_id, vpc_config_id) = _get_application_details(application_name)

    if vpc_config_id:
        # If the application already contains a VPC configuration, it must be removed
        # The version id is updated when the delete_application_vpc_configuration API is invoked
        version_id = _remove_config(application_name, version_id, vpc_config_id)

    """
    If the parameter is empty (i.e. was not provided), CloudFormation will send a list in the following format:
    {
        'SubnetIds': ['']
    }
    We filter out the empty items since the VPC API does not accept null or blank values.
    """
    subnets = _filter_empty_items(subnet_ids)
    securityGroups = _filter_empty_items(security_group_ids)

    if not subnets or not securityGroups:
        logger.info('Either SubnetIds or SecurityGroupIds is empty, not adding configuration')
        return

    return _add_config(application_name, version_id, subnets, securityGroups)

def _delete_vpc_configuration(application_name):
    (version_id, vpc_config_id) = _get_application_details(application_name)

    if vpc_config_id:
        return _remove_config(application_name, version_id, vpc_config_id)

@helper.create
@helper.update
def add_vpc_configuration(event, _):
    _add_vpc_configuration(
        event['ResourceProperties']['ApplicationName'],
        event['ResourceProperties']['SubnetIds'],
        event['ResourceProperties']['SecurityGroupIds']
    )

@helper.delete
def delete_vpc_configuration(event, _):
    _delete_vpc_configuration(event['ResourceProperties']['ApplicationName'])

def handler(event, context):
    helper(event, context)
