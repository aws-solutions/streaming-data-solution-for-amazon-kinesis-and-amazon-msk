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

        cls._kms = botocore.session.get_session().create_client('kms', config=config)
        stubber = Stubber(cls._kms)

        ######################
        ### Stubber responses
        ######################
        # KMS key exists (test_01_kms)
        stubber.add_response('describe_key', {
            'KeyMetadata': {
                'Arn': 'my-kms-key-arn1234567',
                'KeyId': 'my-kms-key-id1234567',
            }
        })

        # KMS key does not exist (test_02_kms)
        stubber.add_response('describe_key', {})

        # KMS key exists (test_03_kms)
        stubber.add_response('describe_key', {
            'KeyMetadata': {
                'Arn': 'my-kms-key-arn1234567',
                'KeyId': 'my-kms-key-id1234567',
            }
        })

        stubber.activate()

    @classmethod
    def tearDownClass(cls) -> None:
        del os.environ['AWS_SDK_USER_AGENT']

    @patch.object(boto3, 'client')
    def test_01_kms_key_exists(self, mock_client):
        mock_client.return_value = self._kms

        from lambda_function import _get_key_arn_for_kms
        kms_key_arn = _get_key_arn_for_kms('my-kms-key-id1234567')

        self.assertEqual(kms_key_arn, 'my-kms-key-arn1234567')

    @patch.object(boto3, 'client')
    def test_02_kms_key_does_not_exist(self, mock_client):
        mock_client.return_value = self._kms

        try:
            from lambda_function import _get_key_arn_for_kms
            _get_key_arn_for_kms('my-kms-key-id1234567')
        except KeyError:
            pass

    @patch.object(boto3, 'client')
    def test_03_kms_key_exists(self, mock_client):
        mock_client.return_value = self._kms

        from lambda_function import _get_key_arn
        event = {
            'ResourceProperties': {
                'KmsKeyId': 'XXXXXXXXXXXXXXXXXXXX'
            }
        }
        # This call should succeed without any exceptions raised.
        _get_key_arn(event, None)

    def test_04_delete(self):
        from lambda_function import no_op
        no_op(None, None)
