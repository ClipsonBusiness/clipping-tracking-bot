import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function createTestCampaigns() {
  try {
    console.log('Creating test campaigns...');

    // Create Campaign 1
    const campaign1 = await prisma.campaign.create({
      data: {
        name: 'Summer 2024 Campaign',
        description: 'Submit your best summer content! Focus on outdoor activities, travel, and lifestyle.',
        status: 'ACTIVE',
      },
    });

    console.log('✓ Created campaign 1:', campaign1.name);

    // Create Campaign 2
    const campaign2 = await prisma.campaign.create({
      data: {
        name: 'Tech Innovation Challenge',
        description: 'Showcase your tech content - tutorials, reviews, and innovation stories.',
        status: 'ACTIVE',
      },
    });

    console.log('✓ Created campaign 2:', campaign2.name);

    console.log('\n✅ Test campaigns created successfully!');
    console.log(`Campaign 1 ID: ${campaign1.id}`);
    console.log(`Campaign 2 ID: ${campaign2.id}`);
  } catch (error) {
    console.error('Error creating campaigns:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

createTestCampaigns();


