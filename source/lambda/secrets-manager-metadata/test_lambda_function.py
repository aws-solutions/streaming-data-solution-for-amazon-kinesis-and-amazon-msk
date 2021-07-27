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

import unittest, boto3, os, json
import botocore.config
import botocore.session
from botocore.stub import Stubber
from unittest.mock import patch

class LambdaTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        os.environ['AWS_SDK_USER_AGENT'] = '{ "user_agent_extra": "AwsSolution/SO9999/v0.0.1" }'
        config = botocore.config.Config(**json.loads(os.environ['AWS_SDK_USER_AGENT']))

        cls._secretsManager = botocore.session.get_session().create_client('secretsmanager', config=config)
        stubber = Stubber(cls._secretsManager)

        # Secret does not follow naming convention
        stubber.add_response('describe_secret', {
            'ARN': 'my-secret-arn-1A2B3C',
            'Name': 'my-secret-name',
            'KmsKeyId': 'my-kms-key-id'
        })

        # Secret does not use custom KMS key
        stubber.add_response('describe_secret', {
            'ARN': 'my-secret-arn-1A2B3C',
            'Name': 'AmazonMSK_my-secret-name',
        })

        stubber.add_response('describe_secret', {
            'ARN': 'my-secret-arn-1A2B3C',
            'Name': 'AmazonMSK_my-secret-name',
            'KmsKeyId': 'my-kms-key-id'
        })

        stubber.activate()

    @classmethod
    def tearDownClass(cls):
        del os.environ['AWS_SDK_USER_AGENT']

    @patch.object(boto3, 'client')
    def test_01_invalid_naming_convention(self, mock_client):
        mock_client.return_value = self._secretsManager

        try:
            from lambda_function import _get_key_arn_for_secret
            _get_key_arn_for_secret('my-secret-arn')
            self.fail('Custom resource should fail when secret name does not start with AmazonMSK_')
        except:
            pass

    @patch.object(boto3, 'client')
    def test_02_invalid_encryption_key(self, mock_client):
        mock_client.return_value = self._secretsManager

        try:
            from lambda_function import _get_key_arn_for_secret
            _get_key_arn_for_secret('my-secret-arn')
            self.fail('Custom resource should fail when secret uses default KMS key')
        except:
            pass

    @patch.object(boto3, 'client')
    def test_03_get_key_id(self, mock_client):
        mock_client.return_value = self._secretsManager

        from lambda_function import _get_key_arn_for_secret
        kms_key_id = _get_key_arn_for_secret('my-secret-arn')
        self.assertIsNotNone(kms_key_id)
