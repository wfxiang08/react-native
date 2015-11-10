/**
 * The examples provided by Facebook are for non-commercial testing and
 * evaluation purposes only.
 *
 * Facebook reserves all rights not expressly granted.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
 * OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NON INFRINGEMENT. IN NO EVENT SHALL
 * FACEBOOK BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN
 * AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
 * CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 *
 * @providesModule ExampleTypes
 * @flow
 */
'use strict';

// 两个类型:
// Example, renderable？
// 定义类类型
export type Example = {
  title: string,
  /* $FlowFixMe(>=0.16.0) */
  render: () => ?ReactElement<any, any, any>,
  description?: string,
  platform?: string;
};

// 包含多个Example的Module对象， 但是不是renderable的
export type ExampleModule = {
  title: string;
  description: string;
  examples: Array<Example>;
  external?: bool;
};
