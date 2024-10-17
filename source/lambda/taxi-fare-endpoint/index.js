/** ************************************************************************************************
*   Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.                             *
*   SPDX-License-Identifier: Apache-2.0                                                            *
 ************************************************************************************************ */
exports.handler = async (event) => {
    console.log(`Event: ${JSON.stringify(event)}`);

    const id = parseFloat(event.queryStringParameters.ride_request_id);
    if (!id) {
        return {
            'statusCode': 400,
            'body': 'Missing ride_request_id',
            'isBase64Encoded': false
        }
    }

    const pseudoRandom = (Math.E * id) % 1;
    const noiseFactor = 1 + (pseudoRandom * 0.4) - 0.2;
    const randomFare = Math.floor(pseudoRandom * (100 - 10 + 1) + 10);

    const response = {
        'statusCode': 200,
        'body': JSON.stringify({
            'ride_request_id': id,
            'expected_fare': randomFare * noiseFactor
        }),
        'isBase64Encoded': false
    };

    console.log(`Response: ${JSON.stringify(response)}`);
    return response;
};
