///<reference types="mocha" />
import * as self from '..'
import * as assert from 'assert'
import 'source-map-support/register'

function readType(type: self.simpleFrameType, length: number)
{
    describe(type, function ()
    {
        it('should return ' + length + '/8', function ()
        {
            assert.equal(self.frameTypeLength(type), length / 8);
        })
        it('should read and write from buffer', function ()
        {
            var expected: number = 0;
            for (let j = 0; j < length; j++)
            {
                expected += Math.pow(2, j);
            }
            if (length >= 16)
                this.timeout(0);

            var buffer = Buffer.allocUnsafe(Math.ceil(length / 8) + 1);
            var expectedBuffer = Buffer.allocUnsafe(Math.ceil(length / 8) + 1);
            for (let x = 0; x < expected; x++)
            {
                if (length == 32 && x != 0b1001100110011001)
                    continue;

                expectedBuffer.fill(0);
                if (length > 8)
                    if (type.endsWith('LE'))
                        expectedBuffer.writeUIntLE(x, 0, length / 8);
                    else
                        expectedBuffer.writeUIntBE(x, 0, length / 8);
                for (let i = 0; i < 7; i++)
                {
                    if (x == 1 && i == 1 && length == 16)
                        debugger;
                    buffer.fill(0)

                    assert.strictEqual(self.write(buffer, x, { type: type, name: 'prop' }, null, i / 8), undefined, 'writing in buffer');
                    if (i == 0 && length > 8)
                    {
                        assert.deepStrictEqual(buffer, expectedBuffer, `comparing buffers after write for ${x} (${x.toString(2)})`);
                    }
                    assert.deepStrictEqual(self.read(buffer, { type: type, name: 'prop' }, i / 8, null, 0), x, `reading ${i} / 8 in buffer [${buffer.toJSON().data}] for ${x} (${x.toString(2)})`);
                }
            }
        })
    })
}

function readArrayType(type: self.simpleFrameType, length: number)
{
    var arrayType: self.complexFrameType = type + '[]' as any;
    describe(arrayType, function ()
    {
        it('should return -1', function ()
        {
            assert.equal(self.frameTypeLength(arrayType), -1);
        })
        it('should read and write from buffer', function ()
        {
            var expectedValue = 0;
            var arrayElementLength = self.frameTypeLength(type);
            for (let i = 0; i < 8 * arrayElementLength; i++)
            {
                expectedValue += Math.pow(2, i);
            }

            var expected: number[] = [];
            for (let i = 0; i < length; i++)
            {
                expected.push(expectedValue);
            }

            var buffer: Buffer;

            assert.notStrictEqual(buffer = self.write(null, expected, { type: arrayType, name: 'prop', length: 'uint8' }, null, 0), undefined, 'writing in buffer');
            assert.deepEqual(self.read(buffer, { type: arrayType, name: 'prop', length: 'uint8' }, 0, null, length), expected, 'reading array in buffer');
        })
    })
}

describe('read', function ()
{
    readType('bit', 1)
    readType('uint2', 2)
    readType('uint3', 3)
    readType('uint4', 4)
    readType('uint5', 5)
    readType('uint6', 6)
    readType('uint7', 7)
    readType('uint8', 8)
    readType('uint16', 16)
    readType('uint32', 32)
    readType('uint16LE', 16)
    readType('uint32LE', 32)

    readArrayType('uint8', 4)
    readArrayType('uint16', 4)
    readArrayType('uint32', 4)

    describe('string', function ()
    {
        it('should return -1', function ()
        {
            assert.equal(self.frameTypeLength('string'), -1);
        })
        it('should read from buffer', function ()
        {
            var expected = 'string'
            var buffer: Buffer;
            assert.notStrictEqual(buffer = self.write(null, expected, { type: 'string', name: 'prop', length: 'uint8' }, null, 0), undefined, 'writing in buffer');
            assert.equal(self.read(buffer, { type: 'string', name: 'prop', length: 'uint8' }, 0, null, 0), 'string', 'reading in buffer');
        })
    })

    describe('uint64', function ()
    {
        it('should return 8', function ()
        {
            assert.equal(self.frameTypeLength('uint64'), 8);
        })
        it('should read from buffer', function ()
        {
            var expected = 'string12'
            var buffer = Buffer.alloc(8);

            assert.strictEqual(self.write(buffer, expected, { type: 'uint64', name: 'prop' }, null, 0), undefined, 'writing in buffer');
            assert.equal(self.read(buffer, { type: 'uint64', name: 'prop' }, 0, null, 0), expected, 'reading in buffer');
        })
    })
})
