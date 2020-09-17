import { config } from 'dotenv'
config()
import { Construct } from 'constructs'
import { App, TerraformStack, Token } from 'cdktf'
import * as aws from './.gen/providers/aws'

const REGION = process.env.REGION || 'us-east-1'

class EC2Session extends TerraformStack {
  constructor(scope: Construct, name: string) {
    super(scope, name)

    const provider = new aws.AwsProvider(this, 'aws', {
      region: REGION,
    })
    const azs = new aws.DataAwsAvailabilityZones(this, 'region-azs', {
      provider,
      state: 'available',
    })

    const vpc = new aws.Vpc(this, 'vpc', {
      tags: { Name: 'session-manager' },
      cidrBlock: '192.168.0.0/24',
      enableDnsSupport: true,
      enableDnsHostnames: true,
    })

    const ig = new aws.InternetGateway(this, 'ig', {
      vpcId: Token.asString(vpc.id),
    })

    const publicSb = new aws.Subnet(this, 'public-subnet', {
      vpcId: Token.asString(vpc.id),
      cidrBlock: '192.168.0.0/26',
      availabilityZone: `\${${azs.fqn}.names[0]}`,
    })
    const publicRt = new aws.RouteTable(this, 'public-rt', {
      vpcId: Token.asString(vpc.id),
      route: [
        {
          cidrBlock: '0.0.0.0/0',
          gatewayId: Token.asString(ig.id),
          egressOnlyGatewayId: '',
          instanceId: '',
          ipv6CidrBlock: '',
          natGatewayId: '',
          networkInterfaceId: '',
          transitGatewayId: '',
          vpcPeeringConnectionId: '',
        },
      ],
    })
    new aws.RouteTableAssociation(this, 'public-rt-subnet', {
      routeTableId: Token.asString(publicRt.id),
      subnetId: Token.asString(publicSb.id),
    })
  }
}

const app = new App()
new EC2Session(app, 'ec2-tf')
app.synth()
