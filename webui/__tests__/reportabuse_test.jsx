import React from 'react/lib/ReactWithAddons';
import { shallow, mount } from 'enzyme';
import { shallowToJson } from 'enzyme-to-json';
// import ReactTestUtils from 'react-dom/test-utils';
import { ReportAbuse } from '../src/components/reportabuse';


describe('Report abuse form', () => {
	const id = 'a1c2ef96a1e446fa9bd7a2a46d2242d4';
 	const component = shallow(<ReportAbuse params={{ id: id }} />);	
 	// console.log(component.debug());

	it('shall contain a form', () => {
		expect(component.find('form').length).toEqual(1);
		// expect(shallowToJson(component)).toMatchSnapshot();
		expect(component).toMatchSnapshot();
	});

	it('shall have 4 radiobuttons named reason', () => {
		expect(component.find('.radiobuttons').length).toEqual(4);
		expect(shallowToJson(component)).toMatchSnapshot();
	});
	

	it('shall have a send button', () => {
		expect(component.find('#send').length).toEqual(1);
		expect(shallowToJson(component)).toMatchSnapshot();
	});


	it('form test 1', ()=> {
		component.find('#phone').simulate('change', {target: {value: '0739295171'}});
		expect(shallowToJson(component)).toMatchSnapshot();
	});

	it('form test 7', ()=> {
		const callback = jest.fn();
		component.find('form').simulate('submit');

		// expect(callback).toHaveBeenCalled();
		expect(callback.mock.calls.length).toBeGreaterThan(0);
	});


	it('form test 6', ()=> {
    	const phone = component.find('#phone');
		const form = component.find('form').first();
		form.simulate('submit', {
			preventDefault: () => {},
			target: [{value: 'd7868w6wd',}],
		});
		expect(component.phone()).toBe('Please match the requested format.');
	});

	it('form test 2', ()=> {
		component.find('#phone').node.value = '0739295171';
	});


	it('form test 3', ()=> {
		const input = component.find('#phone');

		input.simulate('change',
		  { target: { value: '0739295171' } }
		);

		const val = input.node.value;

		//val is ''
		// this wont actually set the value of the text filed, instead it will just trigger your onChange method. 
		// If you actually need your DOM to be updated and your onChange doesn't handle this for you then you'll need to actually set the value 
		// programatically via wrapper.find('#my-input').node.value = 'abc';
	});

	it('form test 4', ()=> {
		component.find('#copyright').simulate('change', {target: {value: true}});
		component.find('#message').simulate('change', {target: {value: 'my message'}});
		component.find('#name').simulate('change', {target: {value: 'ttt'}});
		component.find('#affiliation').simulate('change', {target: {value: 'affiliation_test'}});
		component.find('#email').simulate('change', {target: {value: 'test@t.com'}});
		component.find('#address').simulate('change', {target: {value: 'ajhdj jdjasd ahd ka'}});
		component.find('#city').simulate('change', {target: {value: 'stockholm'}});
		component.find('#country').simulate('change', {target: {value: 'sweden'}});
		component.find('#zipcode').simulate('change', {target: {value: '12345'}});
		component.find('#phone').simulate('change', {target: {value: '8735382073'}});
		// const button = component.closest('button');
		const form = component.closest('form');
		const children = form.render().children().children();
		form.simulate('submit', { target: { children } });
		// form.simulate('submit');
		// button.simulate('click');
		// component.find('button').simulate('submit', { target: component.find('button').get(0) })
	});

	// it('form test 5', ()=> {
	// 	const form = component.find('form').at(0);
	// 	const children = form.render().children().children();
	// 	form.simulate('submit', { target: { children } });
	// });

});