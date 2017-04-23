import React from 'react/lib/ReactWithAddons';
import { ReportAbuse } from '../src/components/reportabuse';
import { serverCache, notifications, browser } from '../src/data/server.js';
import { shallow } from 'enzyme';
import { shallowToJson } from 'enzyme-to-json';

describe('Report abuse form', () => {
	const id = 'a1c2ef96a1e446fa9bd7a2a46d2242d4';
	const component = shallow(<ReportAbuse params={{ id: id }} />);

	var spy = jest.mock('../src/data/server', ()=> ({serverCache: {reportAbuse: jest.fn()}}));
	jest.mock('../src/data/server', ()=> ({notifications: {success: jest.fn()}}));
	jest.mock('../src/data/server', ()=> ({notifications: {danger: jest.fn()}}));
	jest.mock('../src/data/server', ()=> ({browser: {gotoRecord: jest.fn()}}));


	it('sends the form correctly, 1st try', ()=> {
		var data = {copyright:true, message: 'my message', name:'ttt', affiliation:'affiliation_test', email:'test@t.com', address:'ajhdj jdjasd ahd ka', city:'stockholm', country:'sweden', zipcode:'12345', phone: '8735382073'}
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
		const button = component.closest('button');
		button.simulate('click'); 

		expect(serverCache.reportAbuse).toBeCalledWith(id, data,	
			() => {
                browser.gotoRecord(id);
                notifications.success("The abuse report has been successfully sent");
            },
            () => {
                notifications.danger("The abuse report could not be sent. " +
                                     "Please try again or consult the site administrator");
                component.setState({ sending:false });
            });
		expect(shallowToJson(component)).toMatchSnapshot();
	});

	it('sends the form correctly, 2nd try', ()=> {
		var data = {copyright:true, message: 'my message', name:'ttt', affiliation:'affiliation_test', email:'test@t.com', address:'ajhdj jdjasd ahd ka', city:'stockholm', country:'sweden', zipcode:'12345', phone: '8735382073'}
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
		// button.simulate('click'); 

		component.find('form').simulate('submit'); 
		// expect(serverCache.reportAbuse).toBeCalledWith(id, data);
		expect(serverCache.reportAbuse).toBeCalledWith(id, data,	
			() => {
                browser.gotoRecord(id);
                notifications.success("The abuse report has been successfully sent");
            },
            () => {
                notifications.danger("The abuse report could not be sent. " +
                                     "Please try again or consult the site administrator");
                component.setState({ sending:false });
            });
		expect(shallowToJson(component)).toMatchSnapshot();
	});


	it('sends the form correctly, 3rd try', ()=> {
		var data = {copyright:true, message: 'my message', name:'ttt', affiliation:'affiliation_test', email:'test@t.com', address:'ajhdj jdjasd ahd ka', city:'stockholm', country:'sweden', zipcode:'12345', phone: '8735382073'}
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
		component.find('form').simulate('submit'); 
		expect(spy).toBeCalledWith(id, data);
		expect(shallowToJson(component)).toMatchSnapshot();
	});

});