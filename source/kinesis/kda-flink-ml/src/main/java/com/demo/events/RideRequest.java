/*********************************************************************************************************************
 *  Copyright 2020 Amazon.com, Inc. or its affiliates. All Rights Reserved.                                           *
 *                                                                                                                    *
 *  Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance    *
 *  with the License. A copy of the License is located at                                                             *
 *                                                                                                                    *
 *      http://www.apache.org/licenses/LICENSE-2.0                                                                    *
 *                                                                                                                    *
 *  or in the 'license' file accompanying this file. This file is distributed on an 'AS IS' BASIS, WITHOUT WARRANTIES *
 *  OR CONDITIONS OF ANY KIND, express or implied. See the License for the specific language governing permissions    *
 *  and limitations under the License.                                                                                *
 *********************************************************************************************************************/

package com.demo.events;

public class RideRequest extends Event {
    public Long tripId;

    public final Long rideRequestId;
    public final Long vehicleId;
    public final Double expectedFare;

    public RideRequest(Long rideRequestId) {
        this.rideRequestId = rideRequestId;
        this.vehicleId = null;
        this.expectedFare = null;
    }
    public RideRequest(Long rideRequestId, Long vehicleId) {
        this.rideRequestId = rideRequestId;
        this.vehicleId = vehicleId;
        this.expectedFare = null;
    }

    public RideRequest(Long rideRequestId, Long vehicleId, Double expectedFare) {
        this.rideRequestId = rideRequestId;
        this.vehicleId = vehicleId;
        this.expectedFare = expectedFare;
    }

    public RideRequest withRideRequestId(long rideRequestId) {
        return new RideRequest(rideRequestId, this.vehicleId, this.expectedFare);
    }

    public RideRequest withVehicleId(long vehicleId) {
        return new RideRequest(this.rideRequestId, vehicleId, this.expectedFare);
    }

    public RideRequest withExpectedFare(double expectedFare) {
        return new RideRequest(this.rideRequestId, this.vehicleId, expectedFare);
    }
}
