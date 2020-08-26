# cdk-solution-helper
A lightweight helper function that cleans-up synthesized templates from the AWS Cloud Development Kit (CDK) and prepares them for use with the AWS Solutions publishing pipeline. This function performs the following tasks:

#### Lambda function preparation
Replaces the AssetParameter-style properties that identify source code for Lambda functions with the common variables used by the AWS Solutions publishing pipeline.

- `Code.S3Bucket` is assigned the `%%BUCKET_NAME%%` placeholder value.
- `Code.S3Key` is assigned the `%%SOLUTION_NAME%%`/`%%VERSION%%` placeholder value.

These placeholders are then replaced with the appropriate values using the default find/replace operation run by the pipeline.

Before:
```json
"examplefunction67F55935": {
  "Type": "AWS::Lambda::Function",
  "Properties": {
    "Code": {
      "S3Bucket": {
        "Ref": "AssetParametersd513e93e266931de36e1c7e79c27b196f84ab928fce63d364d9152ca501551f7S3Bucket54E71A95"
      },
      "S3Key": {
        "Fn::Join": [
          "",
          [
            {
              "Fn::Select": [
                0,
                {
                  "Fn::Split": [
                    "||",
                    {
                      "Ref": "AssetParametersd513e93e266931de36e1c7e79c27b196f84ab928fce63d364d9152ca501551f7S3VersionKeyC789D8B1"
                    }
                  ]
                }
              ]
            },
            {
              "Fn::Select": [
                1,
                {
                  "Fn::Split": [
                    "||",
                    {
                      "Ref": "AssetParametersd513e93e266931de36e1c7e79c27b196f84ab928fce63d364d9152ca501551f7S3VersionKeyC789D8B1"
                    }
                  ]
                }
              ]
            }
          ]
        ]
      }
    }
  }
}
```

After helper function run:
```json
"examplefunction67F55935": {
  "Type": "AWS::Lambda::Function",
  "Properties": {
    "Code": {
      "S3Bucket": "%%BUCKET_NAME%%",
      "S3Key": "%%SOLUTION_NAME%%/%%VERSION%%/assetd513e93e266931de36e1c7e79c27b196f84ab928fce63d364d9152ca501551f7.zip"
    }
  }
}
```

After build script run:
```json
"examplefunction67F55935": {
  "Type": "AWS::Lambda::Function",
  "Properties": {
    "Code": {
      "S3Bucket": "solutions",
      "S3Key": "trademarked-solution-name/v1.0.0/asset.d513e93e266931de36e1c7e79c27b196f84ab928fce63d364d9152ca501551f7.zip"
    }
  }
}
```

After CloudFormation deployment:
```json
"examplefunction67F55935": {
  "Type": "AWS::Lambda::Function",
  "Properties": {
    "Code": {
      "S3Bucket": "solutions-us-east-1",
      "S3Key": "trademarked-solution-name/v1.0.0/asset.d513e93e266931de36e1c7e79c27b196f84ab928fce63d364d9152ca501551f7.zip"
    }
  }
}
```

#### Template cleanup
Cleans-up the parameters section and improves readability by removing the AssetParameter-style fields that would have been used to specify Lambda source code properties. This allows solution-specific parameters to be highlighted and removes unnecessary clutter.

Before:
```json
"Parameters": {
  "AssetParametersd513e93e266931de36e1c7e79c27b196f84ab928fce63d364d9152ca501551f7S3Bucket54E71A95": {
    "Type": "String",
    "Description": "S3 bucket for asset d513e93e266931de36e1c7e79c27b196f84ab928fce63d364d9152ca501551f7"
  },
  "AssetParametersd513e93e266931de36e1c7e79c27b196f84ab928fce63d364d9152ca501551f7S3VersionKeyC789D8B1": {
    "Type": "String",
    "Description": "S3 key for asset version d513e93e266931de36e1c7e79c27b196f84ab928fce63d364d9152ca501551f7"
  },
  "AssetParametersd513e93e266931de36e1c7e79c27b196f84ab928fce63d364d9152ca501551f7ArtifactHash7AA751FE": {
    "Type": "String",
    "Description": "Artifact hash for asset d513e93e266931de36e1c7e79c27b196f84ab928fce63d364d9152ca501551f7"
  },
  "CorsEnabled" : {
    "Description" : "Would you like to enable Cross-Origin Resource Sharing (CORS) for the image handler API? Select 'Yes' if so.",
    "Default" : "No",
    "Type" : "String",
    "AllowedValues" : [ "Yes", "No" ]
  }
}
```

After:
```json
"Parameters": {
  "CorsEnabled" : {
    "Description" : "Would you like to enable Cross-Origin Resource Sharing (CORS) for the image handler API? Select 'Yes' if so.",
    "Default" : "No",
    "Type" : "String",
    "AllowedValues" : [ "Yes", "No" ]
  }
}
```

***

Copyright 2020 Amazon.com, Inc. or its affiliates. All Rights Reserved.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
