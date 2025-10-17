#!/usr/bin/env node
/**
 * MongoDB Seeding Script for Parkinson's Tremor Detection System
 * Seeds the database with demo patients, caretakers, doctors, and sample tremor data
 */

const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const User = require('../neuropulse/src/lib/models/User');
const Device = require('../neuropulse/src/lib/models/Device');
const TremorData = require('../neuropulse/src/lib/models/TremorData');

async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/neuropulse');
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
}

async function seedUsers() {
  console.log('🌱 Seeding users...');

  const users = [
    {
      name: 'Dr. Sarah Chen',
      email: 'dr.chen@neurology.com',
      password: 'hashed_password_1', // In production, use bcrypt
      role: 'doctor',
      specialization: 'Neurology',
      phone: '+1-555-0101',
      license: 'MD-12345',
      experience: 15
    },
    {
      name: 'Dr. Michael Rodriguez',
      email: 'dr.rodriguez@neurology.com',
      password: 'hashed_password_2',
      role: 'doctor',
      specialization: 'Movement Disorders',
      phone: '+1-555-0102',
      license: 'MD-67890',
      experience: 12
    },
    {
      name: 'Nurse Emily Johnson',
      email: 'emily.johnson@clinic.com',
      password: 'hashed_password_3',
      role: 'caretaker',
      phone: '+1-555-0201',
      certification: 'RN-54321',
      department: 'Neurology'
    },
    {
      name: 'John Smith',
      email: 'john.smith@email.com',
      password: 'hashed_password_4',
      role: 'patient',
      age: 68,
      diagnosisDate: new Date('2022-03-15'),
      phone: '+1-555-0301',
      address: '123 Main St, Anytown, USA',
      emergencyContact: {
        name: 'Mary Smith',
        phone: '+1-555-0302',
        relationship: 'Spouse'
      }
    },
    {
      name: 'Sarah Johnson',
      email: 'sarah.johnson@email.com',
      password: 'hashed_password_5',
      role: 'patient',
      age: 72,
      diagnosisDate: new Date('2020-11-22'),
      phone: '+1-555-0303',
      address: '456 Oak Ave, Somewhere, USA',
      emergencyContact: {
        name: 'Robert Johnson',
        phone: '+1-555-0304',
        relationship: 'Son'
      }
    },
    {
      name: 'David Wilson',
      email: 'david.wilson@email.com',
      password: 'hashed_password_6',
      role: 'patient',
      age: 65,
      diagnosisDate: new Date('2023-01-10'),
      phone: '+1-555-0305',
      address: '789 Pine Rd, Elsewhere, USA',
      emergencyContact: {
        name: 'Lisa Wilson',
        phone: '+1-555-0306',
        relationship: 'Daughter'
      }
    }
  ];

  // Clear existing users
  await User.deleteMany({});
  console.log('🗑️  Cleared existing users');

  // Insert new users
  const insertedUsers = await User.insertMany(users);
  console.log(`✅ Inserted ${insertedUsers.length} users`);

  return insertedUsers;
}

async function seedDevices(users) {
  console.log('🌱 Seeding devices...');

  const patients = users.filter(user => user.role === 'patient');
  const devices = [];

  // Create devices for each patient
  patients.forEach((patient, index) => {
    devices.push({
      deviceId: `ESP32_MEDICAL_${String(index + 1).padStart(3, '0')}`,
      name: `NeuroPulse-${patient.name.split(' ')[1]}`,
      userId: patient._id,
      isActive: true,
      lastSeen: new Date(),
      batteryLevel: 75 + Math.floor(Math.random() * 25), // 75-100%
      firmwareVersion: '3.0.0',
      deviceType: 'EMG_Monitor',
      location: {
        coordinates: [Math.random() * 180 - 90, Math.random() * 360 - 180], // Random coordinates
        accuracy: 10
      }
    });
  });

  // Clear existing devices
  await Device.deleteMany({});
  console.log('🗑️  Cleared existing devices');

  // Insert new devices
  const insertedDevices = await Device.insertMany(devices);
  console.log(`✅ Inserted ${insertedDevices.length} devices`);

  return insertedDevices;
}

async function seedTremorData(devices, users) {
  console.log('🌱 Seeding tremor data...');

  const patientDevices = devices.filter(device =>
    users.find(user => user._id.equals(device.userId))?.role === 'patient'
  );

  const tremorRecords = [];
  const now = new Date();

  // Generate historical data for the past 30 days
  patientDevices.forEach(device => {
    const patient = users.find(user => user._id.equals(device.userId));

    // Base severity level for this patient (consistent pattern)
    const baseSeverity = patient.name === 'John Smith' ? 25 :
                        patient.name === 'Sarah Johnson' ? 65 : 45;

    for (let i = 0; i < 100; i++) { // 100 records per device
      const timestamp = new Date(now.getTime() - (i * 6 * 60 * 60 * 1000)); // Every 6 hours
      const dayVariation = (Math.random() - 0.5) * 10; // ±5 variation
      const severity = Math.max(0, Math.min(100, baseSeverity + dayVariation));

      // Generate realistic frequency based on severity
      const frequency = 3 + (severity / 100) * 9; // 3-12 Hz range

      // Generate amplitude based on severity
      const amplitude = (severity / 100) * 5; // 0-5 range

      tremorRecords.push({
        deviceId: device._id,
        userId: device.userId,
        timestamp,
        frequency: Math.round(frequency * 10) / 10,
        amplitude: Math.round(amplitude * 10) / 10,
        severityIndex: Math.round(severity),
        rawData: {
          emg: Array.from({ length: 50 }, () => Math.random() * 100) // Sample raw EMG data
        },
        aiInsights: {
          pattern: severity < 20 ? 'normal' :
                  severity < 40 ? 'mild' :
                  severity < 70 ? 'moderate' : 'severe',
          confidence: 0.8 + Math.random() * 0.15,
          recommendations: [
            'Continue regular monitoring',
            'Maintain medication schedule',
            severity > 60 ? 'Consider consulting healthcare provider' : 'No immediate concerns'
          ],
          predictedProgression: severity > 60 ? 'Monitor for rapid progression' : 'Stable pattern detected'
        },
        location: {
          type: 'Point',
          coordinates: device.location.coordinates
        }
      });
    }
  });

  // Clear existing tremor data
  await TremorData.deleteMany({});
  console.log('🗑️  Cleared existing tremor data');

  // Insert new tremor data in batches
  const batchSize = 100;
  for (let i = 0; i < tremorRecords.length; i += batchSize) {
    const batch = tremorRecords.slice(i, i + batchSize);
    await TremorData.insertMany(batch);
    console.log(`📦 Inserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(tremorRecords.length / batchSize)}`);
  }

  console.log(`✅ Inserted ${tremorRecords.length} tremor records`);
}

async function seedDatabase() {
  try {
    console.log('🚀 Starting database seeding...');

    // Seed users
    const users = await seedUsers();

    // Seed devices
    const devices = await seedDevices(users);

    // Seed tremor data
    await seedTremorData(devices, users);

    console.log('🎉 Database seeding completed successfully!');
    console.log('\n📊 Summary:');
    console.log(`   Users: ${users.length}`);
    console.log(`   Devices: ${devices.length}`);
    console.log(`   Tremor Records: ~${devices.length * 100}`);

    console.log('\n👥 Demo Accounts:');
    console.log('   Doctor: dr.chen@neurology.com');
    console.log('   Patient: john.smith@email.com');
    console.log('   Caretaker: emily.johnson@clinic.com');

  } catch (error) {
    console.error('❌ Seeding failed:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
}

// Run seeding if called directly
if (require.main === module) {
  seedDatabase();
}

module.exports = { seedDatabase };
